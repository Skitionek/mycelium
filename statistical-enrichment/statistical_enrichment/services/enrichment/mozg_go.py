"""GO annotation lookups for the Mozg-backed enrichment path.

Answers the two questions :class:`EnrichmentVisualisationService` used to put
to Neo4j -- which GO terms relate to a set of genes, and how many GO terms the
organism has altogether -- from EBI QuickGO through Mozg.

The statistics these terms feed are approximate, and not comparable to the
Neo4j-backed ones
--------------------------------------------------------------------------
``fisher()`` reads both a term's gene count and the whole background gene
universe out of the ``geneNames`` list handed to it.  The Neo4j query could
return every organism gene annotated to a term in one hop; QuickGO only
answers a page at a time, and a gene list costs one request per term.  So:

* each term's ``geneNames`` holds at most ``_BACKGROUND_PAGE_SIZE``
  annotations' worth of organism genes, and
* only the ``_BACKGROUND_TERM_LIMIT`` terms shared by the most submitted genes
  are reported at all.

Both caps shrink the numbers Fisher's exact test is computed from, so p-values
and q-values here are indicative of ranking, not of significance.  Deployments
that need sound enrichment statistics should leave ``MOZG_URL`` unset and keep
reading GO from Neo4j.
"""

import logging
from typing import Dict, List, Sequence, Tuple

import requests

from ..mozg_client import (
    QUICKGO_CONNECTION,
    UNIPROT_CONNECTION,
    MozgQueryError,
    run_query,
)

logger = logging.getLogger(__name__)

# UniProt caps a page at 500 entries, so a batch of symbols must fit in one.
_UNIPROT_BATCH_SIZE = 50
_UNIPROT_PAGE_SIZE = 500

# QuickGO's largest page. One page per term is the budget for a gene list.
_BACKGROUND_PAGE_SIZE = 100

# One request per term is what a background gene list costs, so the number of
# terms is capped. Terms are ranked by how many submitted genes carry them,
# which puts the ones an enrichment run actually reports at the front.
_BACKGROUND_TERM_LIMIT = 200

# Seconds to allow the organism-wide statistics query.
_ORGANISM_STATS_TIMEOUT = 120

# The client groups the visualisation by these labels, which is what the Neo4j
# node labels spelled. QuickGO spells its aspects in snake_case.
_GO_ASPECT_LABELS = {
    "biological_process": "BiologicalProcess",
    "molecular_function": "MolecularFunction",
    "cellular_component": "CellularComponent",
}


def fetch_go_terms(organism_id, gene_names: Sequence[str]) -> List[dict]:
    """GO terms related to ``gene_names``, in the shape ``fisher()`` expects.

    Each term carries ``goId``, ``goTerm``, ``goLabel`` and ``geneNames``, as
    the Neo4j query did. Read the module docstring for what the caps do to the
    resulting statistics.
    """
    accessions = _resolve_uniprot_accessions(organism_id, gene_names)

    submitted_genes_by_term: Dict[Tuple[str, str], List[str]] = {}
    for gene_name, accession in accessions.items():
        for go_id, go_term in _fetch_annotated_terms(accession):
            submitted_genes_by_term.setdefault((go_id, go_term), []).append(gene_name)

    most_shared_first = sorted(
        submitted_genes_by_term.items(), key=lambda term: len(term[1]), reverse=True
    )

    terms = []
    for (go_id, go_term), submitted_genes in most_shared_first[:_BACKGROUND_TERM_LIMIT]:
        try:
            organism_genes, aspect = _fetch_term_background(go_id, organism_id)
        except (MozgQueryError, requests.RequestException):
            # One background lookup per term means a run issues hundreds of
            # requests, so a single upstream hiccup is likely and must not cost
            # the whole enrichment. Dropping the term is the honest fallback:
            # keeping it with only the submitted genes as its background would
            # report it as maximally enriched.
            logger.warning(
                "Dropping GO term %s: QuickGO did not answer for its "
                "organism background.",
                go_id,
                exc_info=True,
            )
            continue

        terms.append(
            {
                "goId": go_id,
                "goTerm": go_term,
                "goLabel": [_GO_ASPECT_LABELS[aspect]] if aspect in _GO_ASPECT_LABELS else [],
                # The submitted genes come first so that a term whose
                # background page happened to miss them still counts them.
                "geneNames": list(dict.fromkeys(submitted_genes + organism_genes)),
            }
        )
    return terms


def fetch_go_term_count(organism_id) -> int:
    """Number of distinct GO terms annotated to the organism.

    QuickGO reports this as an approximate count, which is what
    ``add_q_value`` needs it for -- the size of the term population the
    submitted terms were drawn from.
    """
    rows = run_query(
        connection=QUICKGO_CONNECTION,
        from_entity="/annotation/stats",
        where={"taxonId": str(organism_id)},
        # Statistics over a whole organism take QuickGO well past half a
        # minute; human is ~1.5 million annotations. The caller caches the
        # answer in Redis, so this is paid once per organism.
        timeout=_ORGANISM_STATS_TIMEOUT,
    )

    for value_type in _stats_types(rows):
        if value_type.get("type") == "goId":
            return int(value_type.get("approximateCount") or 0)
    return 0


def _resolve_uniprot_accessions(
    organism_id, gene_names: Sequence[str]
) -> Dict[str, str]:
    """Map each submitted gene symbol to a UniProt accession.

    QuickGO is keyed by gene product, so a symbol has to become an accession
    before any GO term can be looked up. UniProt files these entries under the
    species taxon the enrichment request already carries -- unlike NCBI Gene,
    which needs the strain.

    Symbols are quoted because they come from a user's spreadsheet: in an
    unquoted term a space or a parenthesis changes where UniProt thinks the
    term ends. A symbol containing a double quote cannot be quoted and is no
    gene symbol either, so it is dropped.
    """
    quotable = [gene_name for gene_name in gene_names if '"' not in gene_name]

    accessions: Dict[str, str] = {}
    for chunk in _chunks(quotable, _UNIPROT_BATCH_SIZE):
        symbols = " OR ".join(f'gene_exact:"{gene_name}"' for gene_name in chunk)
        rows = run_query(
            connection=UNIPROT_CONNECTION,
            from_entity="/uniprotkb/search",
            where={
                "query": (
                    f"({symbols}) AND organism_id:{organism_id} AND reviewed:true"
                ),
                "fields": "accession,gene_names",
                "format": "json",
                "size": str(_UNIPROT_PAGE_SIZE),
            },
        )

        wanted = {gene_name.casefold(): gene_name for gene_name in chunk}
        for row in rows:
            accession = row.get("primaryAccession")
            if not accession:
                continue
            for entry_name in _uniprot_gene_names(row):
                gene_name = wanted.get(entry_name.casefold())
                if gene_name is not None and gene_name not in accessions:
                    accessions[gene_name] = accession
    return accessions


def _fetch_annotated_terms(accession: str) -> List[Tuple[str, str]]:
    """``(GO id, GO term name)`` pairs annotated to one UniProt accession.

    Asked of QuickGO's ``stats`` endpoint rather than ``search``: stats answers
    with every distinct term in one response, where ``search`` pages over raw
    annotations and repeats each term once per asserting source.
    """
    rows = run_query(
        connection=QUICKGO_CONNECTION,
        from_entity="/annotation/stats",
        where={"geneProductId": f"UniProtKB:{accession}"},
    )

    terms = []
    for value_type in _stats_types(rows):
        if value_type.get("type") != "goId":
            continue
        for value in value_type.get("values") or []:
            go_id = value.get("key")
            if go_id:
                terms.append((go_id, value.get("name") or go_id))
        break
    return terms


def _fetch_term_background(go_id: str, organism_id) -> Tuple[List[str], str]:
    """Organism gene symbols annotated to one GO term, and the term's aspect.

    Truncated at one QuickGO page; see the module docstring.
    """
    rows = run_query(
        connection=QUICKGO_CONNECTION,
        from_entity="/annotation/search",
        where={
            "goId": go_id,
            "taxonId": str(organism_id),
            # Without this QuickGO also counts annotations to descendant
            # terms, which the Neo4j GO_LINK edges did not.
            "goUsage": "exact",
            "limit": str(_BACKGROUND_PAGE_SIZE),
        },
        select=["symbol", "goAspect"],
    )

    gene_names = []
    aspect = ""
    for row in rows:
        symbol = row.get("symbol")
        if symbol and symbol not in gene_names:
            gene_names.append(symbol)
        aspect = aspect or (row.get("goAspect") or "")
    return gene_names, aspect


def _stats_types(rows: List) -> List[dict]:
    """Value-type blocks of the first group in a QuickGO stats response.

    QuickGO groups its statistics by ``annotation`` and by ``geneProduct``,
    each listing the same distinct values per field; the first group is
    enough. Mozg has already unwrapped the groups out of the envelope.
    """
    for group in rows:
        if isinstance(group, dict) and group.get("types"):
            return [
                value_type
                for value_type in group["types"]
                if isinstance(value_type, dict)
            ]
    return []


def _uniprot_gene_names(entry: dict) -> List[str]:
    """Primary gene name and synonyms of a UniProtKB entry."""
    gene_names = []
    for gene in entry.get("genes") or []:
        primary = (gene.get("geneName") or {}).get("value")
        if primary:
            gene_names.append(primary)
        for synonym in gene.get("synonyms") or []:
            if synonym.get("value"):
                gene_names.append(synonym["value"])
    return gene_names


def _chunks(items: Sequence, size: int):
    """Split a sequence into consecutive chunks of at most ``size`` items."""
    items = list(items)
    for start in range(0, len(items), size):
        yield items[start:start + size]
