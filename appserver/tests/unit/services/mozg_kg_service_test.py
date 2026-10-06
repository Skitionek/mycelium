"""Unit tests for neo4japp.services.mozg_kg_service.

Mozg itself is replaced by a fake transport, so no network or Neo4j is
involved.  The canned rows are the real shapes captured from a live Mozg
against NCBI E-utilities, UniProt, STRING, KEGG and EBI QuickGO -- already
unwrapped the way Mozg's REST driver unwraps a ``results`` envelope.
"""
import json
from types import SimpleNamespace

import flask
import pytest
import requests

from neo4japp.exceptions import ServerException
from neo4japp.services import mozg_client
from neo4japp.services.mozg_kg_service import (
    MozgEnrichmentTableService,
    MozgKgService,
)

NCBI_BASE_URL = 'https://www.ncbi.nlm.nih.gov/gene/{}'
UNIPROT_BASE_URL = 'https://www.uniprot.org/uniprot/{}'

TP53_SUMMARY = {
    'uid': '7157',
    'name': 'TP53',
    'description': 'tumor protein p53',
    'otheraliases': 'BCC7, BMFS5, LFS1, P53, TRP53',
}
BRCA1_SUMMARY = {
    'uid': '672',
    'name': 'BRCA1',
    'description': 'BRCA1 DNA repair associated',
    'otheraliases': 'BRCAI, BRCC1, PPP1R53',
}


class FakeMozg:
    """Answers Mozg queries from canned rows, recording what was asked.

    Rows are registered per ``from`` entity. A list of payloads is handed out
    one per call, which is how the reviewed-then-unreviewed UniProt sequence
    and the per-gene QuickGO calls are driven.
    """

    def __init__(self, rows_by_entity):
        self.rows_by_entity = {
            entity: list(payloads) for entity, payloads in rows_by_entity.items()
        }
        self.queries = []

    def post(self, url, json=None, timeout=None):
        query_input = json['variables']['input']
        self.queries.append(query_input)

        payloads = self.rows_by_entity.get(query_input['from'])
        if payloads is None:
            raise AssertionError(f"unexpected Mozg query for {query_input['from']}")
        rows = payloads.pop(0) if len(payloads) > 1 else payloads[0]
        return FakeResponse({'data': {'query': {'data': rows, 'count': len(rows)}}})

    def where_for(self, entity):
        """The ``where`` of the first query against ``entity``."""
        for query_input in self.queries:
            if query_input['from'] == entity:
                return query_input.get('where', {})
        raise AssertionError(f'no Mozg query was made for {entity}')

    def count_for(self, entity):
        return len([q for q in self.queries if q['from'] == entity])


class FakeResponse:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self._body


class FakeSession:
    """Stands in for the SQLAlchemy session's DomainURLsMap lookups."""

    def __init__(self, base_urls):
        self.base_urls = base_urls

    def query(self, model):
        return FakeDomainQuery(self.base_urls)


class FakeDomainQuery:
    def __init__(self, base_urls):
        self.base_urls = base_urls
        self.domain = None

    def filter(self, criterion):
        # criterion is DomainURLsMap.domain == '<name>'
        self.domain = criterion.right.value
        return self

    def one_or_none(self):
        base_url = self.base_urls.get(self.domain)
        return None if base_url is None else SimpleNamespace(base_URL=base_url)


@pytest.fixture
def app_context():
    """Minimal app context, only so current_app.logger resolves."""
    app = flask.Flask(__name__)
    with app.app_context():
        yield


@pytest.fixture(autouse=True)
def mozg_url(monkeypatch):
    monkeypatch.setenv('MOZG_URL', 'http://mozg.test/graphql')


def install(monkeypatch, rows_by_entity):
    fake = FakeMozg(rows_by_entity)
    monkeypatch.setattr(mozg_client.requests, 'post', fake.post)
    return fake


def kg_service(base_urls=None):
    return MozgKgService(session=FakeSession(base_urls or {}))


# ---------------------------------------------------------------------------
# MozgKgService.match_ncbi_genes
# ---------------------------------------------------------------------------


def test_matches_a_gene_symbol_through_ncbi(monkeypatch, app_context):
    # Given NCBI answers the batched search with TP53's UID
    install(
        monkeypatch,
        {
            '/esearch.fcgi': [[{'esearchresult': {'idlist': ['7157']}}]],
            '/esummary.fcgi': [[{'result': {'uids': ['7157'], '7157': TP53_SUMMARY}}]],
        },
    )
    service = kg_service({'NCBI_Gene': NCBI_BASE_URL})

    # When the official symbol is looked up for human
    matches = service.match_ncbi_genes(['TP53'], '9606')

    # Then the gene's own name and full name come from the summary
    assert matches == [
        {
            'synonym': 'TP53',
            'geneId': 7157,
            'gene': {'name': 'TP53', 'full_name': 'tumor protein p53'},
            'link': 'https://www.ncbi.nlm.nih.gov/gene/7157',
        }
    ]


def test_searches_the_gene_name_field_and_explodes_the_taxonomy(
    monkeypatch, app_context
):
    # Given NCBI answers any search
    fake = install(
        monkeypatch,
        {
            '/esearch.fcgi': [[{'esearchresult': {'idlist': ['7157']}}]],
            '/esummary.fcgi': [[{'result': {'7157': TP53_SUMMARY}}]],
        },
    )
    service = kg_service({'NCBI_Gene': NCBI_BASE_URL})

    # When two gene names are matched in one call
    service.match_ncbi_genes(['TP53', 'BRCA1'], '9606')

    # Then both are OR-ed into one query that uses the field qualifiers NCBI
    # actually recognises, and the organism filter covers strain taxa
    where = fake.where_for('/esearch.fcgi')
    assert where['term'] == (
        '("TP53"[Gene Name] OR "BRCA1"[Gene Name]) AND txid9606[Organism:exp]'
    )
    assert where['db'] == 'gene'
    assert where['retmode'] == 'json'
    assert fake.count_for('/esearch.fcgi') == 1


def test_quotes_gene_names_and_drops_unquotable_ones(monkeypatch, app_context):
    # Given a name carrying a space and a name carrying a double quote
    fake = install(
        monkeypatch,
        {
            '/esearch.fcgi': [[{'esearchresult': {'idlist': []}}]],
            '/esummary.fcgi': [[]],
        },
    )
    service = kg_service({'NCBI_Gene': NCBI_BASE_URL})

    # When they are matched
    service.match_ncbi_genes(['TP 53', 'BRCA1', 'BAD"NAME'], '9606')

    # Then each surviving name is quoted, so NCBI cannot tokenise the space
    # into a match on TP53, and the unquotable one never reaches the query
    term = fake.where_for('/esearch.fcgi')['term']
    assert term.startswith('("TP 53"[Gene Name] OR "BRCA1"[Gene Name])')
    assert 'BAD' not in term


def test_makes_no_request_when_every_name_is_unquotable(monkeypatch, app_context):
    # Given no Mozg query should be made at all
    install(monkeypatch, {})
    service = kg_service({'NCBI_Gene': NCBI_BASE_URL})

    # When only unquotable names are matched
    matches = service.match_ncbi_genes(['BAD"NAME'], '9606')

    # Then nothing matched, and NCBI was never asked
    assert matches == []


def test_resolves_an_alias_to_its_official_gene(monkeypatch, app_context):
    # Given a search for "p53" returns BRCA1 first and TP53 second, and only
    # TP53 lists p53 among its aliases
    install(
        monkeypatch,
        {
            '/esearch.fcgi': [[{'esearchresult': {'idlist': ['672', '7157']}}]],
            '/esummary.fcgi': [
                [{'result': {'672': BRCA1_SUMMARY, '7157': TP53_SUMMARY}}]
            ],
        },
    )
    service = kg_service({'NCBI_Gene': NCBI_BASE_URL})

    # When the alias is looked up
    matches = service.match_ncbi_genes(['p53'], '9606')

    # Then it resolves to TP53, keeping the requested name as the synonym
    assert len(matches) == 1
    assert matches[0]['synonym'] == 'p53'
    assert matches[0]['geneId'] == 7157
    assert matches[0]['gene']['name'] == 'TP53'


def test_prefers_an_official_symbol_over_another_genes_alias(
    monkeypatch, app_context
):
    # Given a gene whose official symbol is the requested name is returned
    # after one that merely lists it as an alias
    alias_holder = {
        'uid': '999',
        'name': 'OTHER1',
        'description': 'some other gene',
        'otheraliases': 'TP53',
    }
    install(
        monkeypatch,
        {
            '/esearch.fcgi': [[{'esearchresult': {'idlist': ['999', '7157']}}]],
            '/esummary.fcgi': [
                [{'result': {'999': alias_holder, '7157': TP53_SUMMARY}}]
            ],
        },
    )
    service = kg_service({'NCBI_Gene': NCBI_BASE_URL})

    # When the name is matched
    matches = service.match_ncbi_genes(['TP53'], '9606')

    # Then the official symbol wins despite being ranked lower
    assert matches[0]['geneId'] == 7157


def test_drops_a_gene_name_nothing_matched(monkeypatch, app_context):
    # Given NCBI finds nothing
    install(
        monkeypatch,
        {
            '/esearch.fcgi': [[{'esearchresult': {'idlist': []}}]],
            '/esummary.fcgi': [[]],
        },
    )
    service = kg_service({'NCBI_Gene': NCBI_BASE_URL})

    # When an unknown name is matched
    matches = service.match_ncbi_genes(['NOT_A_GENE'], '9606')

    # Then it is simply absent, as it was with the Neo4j synonym match
    assert matches == []


def test_enrichment_table_reports_the_ncbi_uid_as_the_node_id(
    monkeypatch, app_context
):
    # Given a matching gene
    install(
        monkeypatch,
        {
            '/esearch.fcgi': [[{'esearchresult': {'idlist': ['7157']}}]],
            '/esummary.fcgi': [[{'result': {'7157': TP53_SUMMARY}}]],
        },
    )
    service = MozgEnrichmentTableService(
        session=FakeSession({'NCBI_Gene': NCBI_BASE_URL})
    )

    # When the enrichment table matches it
    matches = service.match_ncbi_genes(['TP53'], '9606')

    # Then both legacy id fields carry the NCBI UID
    assert matches[0]['geneNeo4jId'] == 7157
    assert matches[0]['synonymNeo4jId'] == 7157
    assert 'geneId' not in matches[0]


# ---------------------------------------------------------------------------
# MozgKgService.get_uniprot_genes
# ---------------------------------------------------------------------------

TP53_UNIPROT_ENTRY = {
    'primaryAccession': 'P04637',
    'comments': [
        {
            'commentType': 'FUNCTION',
            'texts': [{'value': 'Multifunctional transcription factor.'}],
        }
    ],
    'uniProtKBCrossReferences': [{'database': 'GeneID', 'id': '7157'}],
}


def test_reads_the_accession_and_function_comment(monkeypatch, app_context):
    # Given UniProt answers with TP53's reviewed entry
    install(monkeypatch, {'/uniprotkb/search': [[TP53_UNIPROT_ENTRY]]})
    service = kg_service({'uniprot': UNIPROT_BASE_URL})

    # When the gene's UniProt data is fetched
    result = service.get_uniprot_genes([7157])

    # Then the entry is keyed by the gene id it cross-references
    assert result == {
        7157: {
            'result': {
                'id': 'P04637',
                'function': 'Multifunctional transcription factor.',
            },
            'link': 'https://www.uniprot.org/uniprot/P04637',
        }
    }


def test_asks_for_reviewed_entries_first(monkeypatch, app_context):
    # Given UniProt has a reviewed entry for the gene
    fake = install(monkeypatch, {'/uniprotkb/search': [[TP53_UNIPROT_ENTRY]]})
    service = kg_service({'uniprot': UNIPROT_BASE_URL})

    # When it is fetched
    service.get_uniprot_genes([7157])

    # Then only the reviewed query is made, and it carries the cross-reference
    # field that maps entries back to gene ids
    where = fake.where_for('/uniprotkb/search')
    assert where['query'] == '(xref:GeneID-7157) AND reviewed:true'
    assert where['fields'] == 'accession,cc_function,xref_geneid'
    assert fake.count_for('/uniprotkb/search') == 1


def test_falls_back_to_unreviewed_entries(monkeypatch, app_context):
    # Given the gene has no reviewed entry, only an unreviewed one
    unreviewed = {
        'primaryAccession': 'Q53GA5',
        'comments': [],
        'uniProtKBCrossReferences': [{'database': 'GeneID', 'id': '7157'}],
    }
    fake = install(monkeypatch, {'/uniprotkb/search': [[], [unreviewed]]})
    service = kg_service({'uniprot': UNIPROT_BASE_URL})

    # When it is fetched
    result = service.get_uniprot_genes([7157])

    # Then a second, unfiltered query supplies it, with an empty function
    assert fake.count_for('/uniprotkb/search') == 2
    assert fake.queries[1]['where']['query'] == '(xref:GeneID-7157)'
    assert result[7157]['result'] == {'id': 'Q53GA5', 'function': ''}


# ---------------------------------------------------------------------------
# MozgKgService.get_string_genes
# ---------------------------------------------------------------------------


def test_maps_string_rows_back_by_query_item(monkeypatch, app_context):
    # Given STRING echoes each requested identifier back as queryItem
    fake = install(
        monkeypatch,
        {
            '/get_string_ids': [
                [
                    {
                        'queryItem': '7157',
                        'stringId': '9606.ENSP00000269305',
                        'annotation': 'Cellular tumor antigen p53',
                    },
                    {
                        'queryItem': '672',
                        'stringId': '9606.ENSP00000418960',
                        'annotation': 'Breast cancer type 1',
                    },
                ]
            ]
        },
    )
    service = kg_service()

    # When two genes are fetched
    result = service.get_string_genes([7157, 672])

    # Then both resolve, from a single carriage-return separated request
    assert fake.where_for('/get_string_ids')['identifiers'] == '7157\r672'
    assert result[7157]['result']['id'] == '9606.ENSP00000269305'
    assert result[672]['result']['annotation'] == 'Breast cancer type 1'
    assert result[7157]['link'] == (
        'https://string-db.org/cgi/network?identifiers=9606.ENSP00000269305'
    )


# ---------------------------------------------------------------------------
# MozgKgService.get_kegg_genes
# ---------------------------------------------------------------------------


def test_reports_kegg_pathway_names_not_ids(monkeypatch, app_context):
    # Given KEGG converts the gene id, lists its pathways by id, and names
    # the organism's pathways separately
    fake = install(
        monkeypatch,
        {
            '/conv/genes': [[{'entry_id': 'ncbi-geneid:7157', 'name': 'hsa:7157'}]],
            '/link/pathway': [
                [
                    {'source_id': 'hsa:7157', 'target_id': 'path:hsa04110'},
                    {'source_id': 'hsa:7157', 'target_id': 'path:hsa04115'},
                ]
            ],
            '/list/pathway': [
                [
                    {'entry_id': 'hsa04110', 'name': 'Cell cycle - Homo sapiens'},
                    {'entry_id': 'hsa04115', 'name': 'p53 signaling pathway'},
                ]
            ],
        },
    )
    service = kg_service()

    # When the gene's KEGG data is fetched
    result = service.get_kegg_genes([7157])

    # Then the pathway ids have been resolved to names
    assert result == {
        7157: {
            'result': ['Cell cycle - Homo sapiens', 'p53 signaling pathway'],
            'link': 'https://www.genome.jp/entry/hsa:7157',
        }
    }
    # and the identifier was passed as a path segment, not a query parameter
    assert fake.where_for('/conv/genes') == {'_pathSuffix': 'ncbi-geneid:7157'}
    assert fake.where_for('/link/pathway') == {'_pathSuffix': 'hsa:7157'}
    assert fake.where_for('/list/pathway') == {'_pathSuffix': 'hsa'}


def test_keeps_a_pathway_id_that_has_no_name(monkeypatch, app_context):
    # Given KEGG links a pathway the organism list does not name
    install(
        monkeypatch,
        {
            '/conv/genes': [[{'entry_id': 'ncbi-geneid:7157', 'name': 'hsa:7157'}]],
            '/link/pathway': [
                [{'source_id': 'hsa:7157', 'target_id': 'path:hsa99999'}]
            ],
            '/list/pathway': [[]],
        },
    )
    service = kg_service()

    # When the gene's KEGG data is fetched
    result = service.get_kegg_genes([7157])

    # Then the id stands in for the missing name
    assert result[7157]['result'] == ['hsa99999']


# ---------------------------------------------------------------------------
# MozgKgService.get_go_genes
# ---------------------------------------------------------------------------


def test_reads_distinct_go_terms_from_quickgo_statistics(monkeypatch, app_context):
    # Given the gene resolves to a UniProt accession whose QuickGO statistics
    # list its distinct GO terms
    fake = install(
        monkeypatch,
        {
            '/uniprotkb/search': [[TP53_UNIPROT_ENTRY]],
            '/annotation/stats': [
                [
                    {
                        'groupName': 'annotation',
                        'types': [
                            {'type': 'reference', 'values': [{'key': 'GO_REF:1'}]},
                            {
                                'type': 'goId',
                                'values': [
                                    {'key': 'GO:0005515', 'name': 'protein binding'},
                                    {'key': 'GO:0005634', 'name': 'nucleus'},
                                ],
                            },
                        ],
                    }
                ]
            ],
        },
    )
    service = kg_service({'uniprot': UNIPROT_BASE_URL})

    # When the gene's GO terms are fetched
    result = service.get_go_genes([7157])

    # Then the term names are reported for the gene id, from the goId block
    assert result[7157]['result'] == ['protein binding', 'nucleus']
    assert result[7157]['link'] == (
        'https://www.ebi.ac.uk/QuickGO/annotations?geneProductId='
    )
    assert fake.where_for('/annotation/stats') == {
        'geneProductId': 'UniProtKB:P04637'
    }


def test_reports_no_go_terms_without_a_uniprot_entry(monkeypatch, app_context):
    # Given the gene has no UniProt entry at all
    install(monkeypatch, {'/uniprotkb/search': [[]]})
    service = kg_service({'uniprot': UNIPROT_BASE_URL})

    # When its GO terms are fetched
    result = service.get_go_genes([7157])

    # Then QuickGO is never asked and the domain is simply absent
    assert result == {}


# ---------------------------------------------------------------------------
# Domains whose upstream cannot be reached
# ---------------------------------------------------------------------------


def test_biocyc_is_empty_rather_than_failing(monkeypatch, app_context):
    # Given no Mozg query should be made at all
    install(monkeypatch, {})
    service = kg_service()

    # When the BioCyc domain is requested
    result = service.get_biocyc_genes([7157], '9606')

    # Then it is reported as missing, not as an error
    assert result == {}


def test_regulondb_is_empty_rather_than_failing(monkeypatch, app_context):
    # Given no Mozg query should be made at all
    install(monkeypatch, {})
    service = kg_service()

    # When the RegulonDB domain is requested
    result = service.get_regulon_genes([7157])

    # Then it is reported as missing, not as an error
    assert result == {}


# ---------------------------------------------------------------------------
# Upstream failures
# ---------------------------------------------------------------------------


def test_a_mozg_error_becomes_a_server_exception(monkeypatch, app_context):
    # Given Mozg reports that it could not reach UniProt
    def failing_post(url, json=None, timeout=None):
        return FakeResponse({'errors': [{'message': 'Unexpected error.'}]})

    monkeypatch.setattr(mozg_client.requests, 'post', failing_post)
    service = kg_service({'uniprot': UNIPROT_BASE_URL})

    # When a domain backed by it is requested
    with pytest.raises(ServerException) as error:
        service.get_uniprot_genes([7157])

    # Then the message names the database rather than leaking Mozg's internals
    assert 'UniProt' in error.value.message


def test_an_unreachable_mozg_becomes_a_server_exception(monkeypatch, app_context):
    # Given Mozg itself cannot be reached
    def refusing_post(url, json=None, timeout=None):
        raise requests.ConnectionError('connection refused')

    monkeypatch.setattr(mozg_client.requests, 'post', refusing_post)
    service = kg_service({'uniprot': UNIPROT_BASE_URL})

    # When a domain is requested
    with pytest.raises(ServerException):
        service.get_uniprot_genes([7157])


# ---------------------------------------------------------------------------
# mozg_client.run_query
# ---------------------------------------------------------------------------


def test_sends_the_connection_entity_and_filters_mozg_expects(monkeypatch):
    # Given a Mozg that records the GraphQL variables
    sent = {}

    def recording_post(url, json=None, timeout=None):
        sent['url'] = url
        sent['body'] = json
        return FakeResponse({'data': {'query': {'data': [], 'count': 0}}})

    monkeypatch.setattr(mozg_client.requests, 'post', recording_post)
    monkeypatch.setenv('MOZG_URL', 'http://mozg.test/graphql')

    # When a query is run
    mozg_client.run_query(
        mozg_client.KEGG_CONNECTION,
        '/link/pathway',
        where={'_pathSuffix': 'hsa:7157'},
        select=['target_id'],
        limit=5,
    )

    # Then it goes to the configured endpoint as a single query input
    assert sent['url'] == 'http://mozg.test/graphql'
    assert sent['body']['variables']['input'] == {
        'connection': mozg_client.KEGG_CONNECTION,
        'from': '/link/pathway',
        'where': {'_pathSuffix': 'hsa:7157'},
        'select': ['target_id'],
        'limit': 5,
    }


def test_omits_filters_that_were_not_given(monkeypatch):
    # Given a Mozg that records the GraphQL variables
    sent = {}

    def recording_post(url, json=None, timeout=None):
        sent['body'] = json
        return FakeResponse({'data': {'query': {'data': [], 'count': 0}}})

    monkeypatch.setattr(mozg_client.requests, 'post', recording_post)
    monkeypatch.setenv('MOZG_URL', 'http://mozg.test/graphql')

    # When a query is run with nothing but a connection and an entity
    mozg_client.run_query(mozg_client.NCBI_CONNECTION, '/einfo.fcgi')

    # Then Mozg is not handed null filters to interpret
    assert sent['body']['variables']['input'] == {
        'connection': mozg_client.NCBI_CONNECTION,
        'from': '/einfo.fcgi',
    }


def test_raises_when_mozg_reports_errors(monkeypatch):
    # Given Mozg answers with a GraphQL error
    def failing_post(url, json=None, timeout=None):
        return FakeResponse({'errors': [{'message': 'Unexpected error.'}]})

    monkeypatch.setattr(mozg_client.requests, 'post', failing_post)
    monkeypatch.setenv('MOZG_URL', 'http://mozg.test/graphql')

    # When a query is run
    with pytest.raises(mozg_client.MozgQueryError) as error:
        mozg_client.run_query(mozg_client.UNIPROT_CONNECTION, '/uniprotkb/search')

    # Then the failure names the entity and the upstream that was queried
    assert str(error.value).startswith(
        'Mozg could not answer /uniprotkb/search on '
        f"{mozg_client.UNIPROT_CONNECTION['database']}"
    )


def test_reads_the_endpoint_at_call_time(monkeypatch):
    # Given MOZG_URL changes after the module was imported
    monkeypatch.setenv('MOZG_URL', 'http://elsewhere.test/graphql')
    sent = {}

    def recording_post(url, json=None, timeout=None):
        sent['url'] = url
        return FakeResponse({'data': {'query': {'data': [], 'count': 0}}})

    monkeypatch.setattr(mozg_client.requests, 'post', recording_post)

    # When a query is run
    mozg_client.run_query(mozg_client.NCBI_CONNECTION, '/einfo.fcgi')

    # Then the new endpoint is used
    assert sent['url'] == 'http://elsewhere.test/graphql'


# ---------------------------------------------------------------------------
# Connection descriptors
# ---------------------------------------------------------------------------


def test_every_connection_names_a_driver_and_a_database():
    # Given the descriptors Mozg queries are built from
    connections = [
        mozg_client.NCBI_CONNECTION,
        mozg_client.UNIPROT_CONNECTION,
        mozg_client.STRING_CONNECTION,
        mozg_client.KEGG_CONNECTION,
        mozg_client.QUICKGO_CONNECTION,
    ]

    # When each is inspected
    # Then it carries the two fields Mozg's ConnectionInput requires
    for connection in connections:
        assert connection['driver']
        assert connection['database'].startswith('https://')


def test_connections_are_json_serialisable():
    # Given the descriptors are sent as GraphQL variables
    connections = [mozg_client.UNIPROT_CONNECTION, mozg_client.KEGG_CONNECTION]

    # When they are serialised and read back
    decoded = json.loads(json.dumps(connections))

    # Then nothing in them needed a custom encoder or lost a field
    assert decoded == connections
