"""Unit tests for the Mozg-backed GO lookups.

Mozg is replaced by a fake transport.  The canned rows are the real shapes
captured from a live Mozg against UniProt and EBI QuickGO -- already unwrapped
the way Mozg's REST driver unwraps a ``results`` envelope.
"""

import pytest
import requests

from statistical_enrichment.services import mozg_client
from statistical_enrichment.services.enrichment import mozg_go

TP53_UNIPROT_ENTRY = {
    "primaryAccession": "P04637",
    "genes": [
        {
            "geneName": {"value": "TP53"},
            "synonyms": [{"value": "P53"}],
        }
    ],
}
BRCA1_UNIPROT_ENTRY = {
    "primaryAccession": "P38398",
    "genes": [{"geneName": {"value": "BRCA1"}, "synonyms": []}],
}


def stats_response(values, group_name="annotation", extra_types=()):
    """A QuickGO statistics body as Mozg hands it over: groups unwrapped."""
    return [
        {
            "groupName": group_name,
            "types": [*extra_types, {"type": "goId", "values": values}],
        }
    ]


def annotation_rows(symbols, aspect="biological_process"):
    return [{"symbol": symbol, "goAspect": aspect} for symbol in symbols]


class FakeMozg:
    """Answers Mozg queries from canned rows, recording what was asked.

    ``rows_for`` is called with the query input and returns the rows, which
    lets a test vary its answer by entity and by filter.
    """

    def __init__(self, rows_for):
        self.rows_for = rows_for
        self.queries = []

    def post(self, url, json=None, timeout=None):
        query_input = json["variables"]["input"]
        self.queries.append(query_input)
        rows = self.rows_for(query_input)
        return FakeResponse({"data": {"query": {"data": rows, "count": len(rows)}}})

    def where_for(self, entity):
        for query_input in self.queries:
            if query_input["from"] == entity:
                return query_input.get("where", {})
        raise AssertionError(f"no Mozg query was made for {entity}")

    def wheres_for(self, entity):
        return [
            query_input.get("where", {})
            for query_input in self.queries
            if query_input["from"] == entity
        ]


class FakeResponse:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self._body


@pytest.fixture(autouse=True)
def mozg_url(monkeypatch):
    monkeypatch.setenv("MOZG_URL", "http://mozg.test/graphql")


def install(monkeypatch, rows_for):
    fake = FakeMozg(rows_for)
    monkeypatch.setattr(mozg_client.requests, "post", fake.post)
    return fake


# ---------------------------------------------------------------------------
# mozg_go.fetch_go_terms
# ---------------------------------------------------------------------------


def test_returns_terms_in_the_shape_fisher_expects(monkeypatch):
    # Given TP53 resolves to an accession annotated with one GO term, which
    # the organism shares with two other genes
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response(
                [{"key": "GO:0006915", "name": "apoptotic process"}]
            )
        return annotation_rows(["CASP3", "BAX"])

    install(monkeypatch, rows_for)

    # When the terms related to TP53 are fetched
    terms = mozg_go.fetch_go_terms(9606, ["TP53"])

    # Then each term carries the four keys the Neo4j query returned
    assert terms == [
        {
            "goId": "GO:0006915",
            "goTerm": "apoptotic process",
            "goLabel": ["BiologicalProcess"],
            "geneNames": ["TP53", "CASP3", "BAX"],
        }
    ]


def test_looks_up_accessions_by_exact_symbol_for_the_organism(monkeypatch):
    # Given UniProt answers with both requested genes
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY, BRCA1_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response([])
        return []

    fake = install(monkeypatch, rows_for)

    # When two gene symbols are looked up
    mozg_go.fetch_go_terms(9606, ["TP53", "BRCA1"])

    # Then one query resolves both, scoped to the organism and to curated
    # entries, using the exact-symbol field rather than a free-text match
    where = fake.where_for("/uniprotkb/search")
    assert where["query"] == (
        '(gene_exact:"TP53" OR gene_exact:"BRCA1") AND organism_id:9606 '
        "AND reviewed:true"
    )
    assert where["fields"] == "accession,gene_names"
    assert len(fake.wheres_for("/uniprotkb/search")) == 1


def test_matches_a_submitted_name_against_a_uniprot_synonym(monkeypatch):
    # Given the submitted name is a synonym on the entry, not its primary name
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response([{"key": "GO:0006915", "name": "apoptosis"}])
        return annotation_rows(["CASP3"])

    install(monkeypatch, rows_for)

    # When the synonym is submitted
    terms = mozg_go.fetch_go_terms(9606, ["P53"])

    # Then it still resolves, and the submitted spelling is what is reported
    assert terms[0]["geneNames"][0] == "P53"


def test_labels_each_aspect_the_way_the_client_groups_them(monkeypatch):
    # Given QuickGO reports one term per aspect, in its own snake_case
    aspects = {
        "GO:0006915": "biological_process",
        "GO:0005515": "molecular_function",
        "GO:0005634": "cellular_component",
    }

    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response(
                [{"key": go_id, "name": go_id} for go_id in aspects]
            )
        return annotation_rows(["CASP3"], aspect=aspects[query_input["where"]["goId"]])

    install(monkeypatch, rows_for)

    # When the terms are fetched
    terms = mozg_go.fetch_go_terms(9606, ["TP53"])

    # Then the labels match the keys the visualisation groups by
    labels = {term["goId"]: term["goLabel"] for term in terms}
    assert labels == {
        "GO:0006915": ["BiologicalProcess"],
        "GO:0005515": ["MolecularFunction"],
        "GO:0005634": ["CellularComponent"],
    }


def test_leaves_the_label_empty_for_an_unknown_aspect(monkeypatch):
    # Given QuickGO reports an aspect the client has no group for
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response([{"key": "GO:0006915", "name": "apoptosis"}])
        return annotation_rows(["CASP3"], aspect="something_new")

    install(monkeypatch, rows_for)

    # When the terms are fetched
    terms = mozg_go.fetch_go_terms(9606, ["TP53"])

    # Then the term is still reported, just ungrouped
    assert terms[0]["goLabel"] == []


def test_restricts_the_background_to_the_term_itself(monkeypatch):
    # Given a term with an organism background
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response([{"key": "GO:0006915", "name": "apoptosis"}])
        return annotation_rows(["CASP3"])

    fake = install(monkeypatch, rows_for)

    # When the terms are fetched
    mozg_go.fetch_go_terms(9606, ["TP53"])

    # Then the background query is scoped to the organism and excludes
    # descendant terms, which the Neo4j GO_LINK edges also did
    where = fake.where_for("/annotation/search")
    assert where["goId"] == "GO:0006915"
    assert where["taxonId"] == "9606"
    assert where["goUsage"] == "exact"


def test_counts_a_submitted_gene_the_background_page_missed(monkeypatch):
    # Given the background page does not happen to include TP53 itself
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response([{"key": "GO:0006915", "name": "apoptosis"}])
        return annotation_rows(["CASP3", "BAX"])

    install(monkeypatch, rows_for)

    # When the terms are fetched
    terms = mozg_go.fetch_go_terms(9606, ["TP53"])

    # Then the submitted gene is counted anyway, exactly once
    assert terms[0]["geneNames"].count("TP53") == 1


def test_deduplicates_repeated_background_symbols(monkeypatch):
    # Given QuickGO repeats a gene once per asserting source
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response([{"key": "GO:0006915", "name": "apoptosis"}])
        return annotation_rows(["CASP3", "CASP3", "BAX"])

    install(monkeypatch, rows_for)

    # When the terms are fetched
    terms = mozg_go.fetch_go_terms(9606, ["TP53"])

    # Then each gene is counted once, or the term's gene count is inflated
    assert terms[0]["geneNames"] == ["TP53", "CASP3", "BAX"]


def test_reports_the_most_widely_shared_terms_first_and_caps_them(monkeypatch):
    # Given two genes, one term shared by both and many carried by only one
    shared = {"key": "GO:SHARED", "name": "shared term"}
    unshared = [
        {"key": f"GO:{index:05d}", "name": f"term {index}"}
        for index in range(mozg_go._BACKGROUND_TERM_LIMIT + 50)
    ]

    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY, BRCA1_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            if query_input["where"]["geneProductId"] == "UniProtKB:P04637":
                return stats_response([shared, *unshared])
            return stats_response([shared])
        return annotation_rows(["CASP3"])

    install(monkeypatch, rows_for)

    # When the terms are fetched
    terms = mozg_go.fetch_go_terms(9606, ["TP53", "BRCA1"])

    # Then the capped list is returned, led by the term both genes carry
    assert len(terms) == mozg_go._BACKGROUND_TERM_LIMIT
    assert terms[0]["goId"] == "GO:SHARED"


def test_quotes_submitted_symbols_and_drops_unquotable_ones(monkeypatch):
    # Given a symbol carrying a space and one carrying a double quote
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response([])
        return []

    fake = install(monkeypatch, rows_for)

    # When they are looked up
    mozg_go.fetch_go_terms(9606, ['TP 53', 'BRCA1', 'BAD"NAME'])

    # Then each surviving symbol is quoted, so UniProt cannot read the space as
    # the end of the term, and the unquotable one never reaches the query
    query = fake.where_for("/uniprotkb/search")["query"]
    assert 'gene_exact:"TP 53" OR gene_exact:"BRCA1"' in query
    assert "BAD" not in query


def test_drops_a_term_whose_background_lookup_fails(monkeypatch):
    # Given QuickGO answers term discovery but fails the background lookup for
    # one of two terms
    def rows_for(query_input):
        if query_input["from"] == "/uniprotkb/search":
            return [TP53_UNIPROT_ENTRY]
        if query_input["from"] == "/annotation/stats":
            return stats_response(
                [
                    {"key": "GO:0006915", "name": "apoptosis"},
                    {"key": "GO:0005515", "name": "protein binding"},
                ]
            )
        if query_input["where"]["goId"] == "GO:0006915":
            raise requests.ConnectionError("connection reset")
        return annotation_rows(["CASP3"])

    install(monkeypatch, rows_for)

    # When the terms are fetched
    terms = mozg_go.fetch_go_terms(9606, ["TP53"])

    # Then the run survives and reports only the term it has a background for,
    # rather than reporting the other as maximally enriched
    assert [term["goId"] for term in terms] == ["GO:0005515"]


def test_returns_nothing_when_no_symbol_resolves(monkeypatch):
    # Given UniProt knows none of the submitted symbols
    install(monkeypatch, lambda query_input: [])

    # When the terms are fetched
    terms = mozg_go.fetch_go_terms(9606, ["NOT_A_GENE"])

    # Then the caller is left to raise, as it does for an empty Neo4j result
    assert terms == []


# ---------------------------------------------------------------------------
# mozg_go.fetch_go_term_count
# ---------------------------------------------------------------------------


def test_reads_the_organisms_distinct_term_count(monkeypatch):
    # Given QuickGO reports the organism's approximate counts per field
    organism_stats = [
        {
            "groupName": "annotation",
            "types": [
                {"type": "reference", "approximateCount": 67000},
                {"type": "goId", "approximateCount": 18000},
            ],
        }
    ]
    fake = install(monkeypatch, lambda query_input: organism_stats)

    # When the organism's term count is fetched
    count = mozg_go.fetch_go_term_count(9606)

    # Then the GO-term field's count is the one taken
    assert count == 18000
    assert fake.where_for("/annotation/stats") == {"taxonId": "9606"}


def test_counts_zero_when_quickgo_reports_no_terms(monkeypatch):
    # Given QuickGO answers without a goId block
    install(
        monkeypatch,
        lambda query_input: [
            {"groupName": "annotation", "types": [{"type": "reference"}]}
        ],
    )

    # When the organism's term count is fetched
    count = mozg_go.fetch_go_term_count(9606)

    # Then it is zero, which the caller turns into a failure
    assert count == 0
