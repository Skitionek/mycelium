"""Knowledge-graph service backed by Mozg.

This module replaces the Neo4j-based :class:`~neo4japp.services.KgService`
enrichment methods with equivalent lookups that go through the Mozg GraphQL
endpoint (https://github.com/Skitionek/Mozg).  Instead of reading from a
pre-loaded local Neo4j copy of BioCyc / UniProt / STRING / KEGG / GO /
RegulonDB, each query hits the canonical upstream REST API directly.

The public API is intentionally kept compatible with :class:`KgService` so
that callers require minimal changes.
"""

import time
from typing import Any, Dict, List, Optional

from flask import current_app

from neo4japp.constants import BIOCYC_ORG_ID_DICT, LogEventType
from neo4japp.exceptions import ServerException
from neo4japp.models import DomainURLsMap
from neo4japp.utils.logger import EventLog

from .mozg_client import (
    BIOCYC_CONNECTION,
    GO_CONNECTION,
    KEGG_CONNECTION,
    NCBI_CONNECTION,
    REGULONDB_CONNECTION,
    STRING_CONNECTION,
    UNIPROT_CONNECTION,
    run_query,
)


class MozgKgService:
    """Knowledge-graph service that delegates all biological-database lookups
    to the Mozg GraphQL layer instead of a local Neo4j instance.

    :param session: SQLAlchemy session (still required for :class:`DomainURLsMap`
        lookups stored in the relational database).
    """

    def __init__(self, session):
        self.session = session

    # ------------------------------------------------------------------
    # NCBI gene matching
    # ------------------------------------------------------------------

    def match_ncbi_genes(
        self, gene_names: List[str], organism: str
    ) -> List[Dict[str, Any]]:
        """Match gene names to NCBI Gene records via the NCBI E-utilities API.

        Returns one dict per matched gene with keys compatible with the legacy
        Neo4j-based implementation:

        ``synonym``, ``geneId``, ``gene``, ``link``

        ``geneId`` is the NCBI Gene UID (integer), which downstream enrichment
        calls use as the lookup key (replacing the old ``geneNeo4jId``).
        """
        start = time.time()

        ncbi_url = self.session.query(DomainURLsMap).filter(
            DomainURLsMap.domain == "NCBI_Gene"
        ).one_or_none()
        if ncbi_url is None:
            raise ServerException(
                title="Could not create enrichment table",
                message="There was a problem finding NCBI domain URLs.",
            )

        results = []
        for gene_name in gene_names:
            search_term = f"{gene_name}[gene_name] AND {organism}[taxid]"
            rows = run_query(
                connection=NCBI_CONNECTION,
                from_entity="esearch.fcgi",
                where={"db": "gene", "term": search_term, "retmode": "json"},
                limit=1,
            )
            gene_id = _extract_ncbi_gene_id(rows)
            if gene_id is None:
                continue

            # Fetch gene summary for full_name
            summary_rows = run_query(
                connection=NCBI_CONNECTION,
                from_entity="esummary.fcgi",
                where={"db": "gene", "id": str(gene_id), "retmode": "json"},
                limit=1,
            )
            full_name = _extract_ncbi_gene_full_name(summary_rows, gene_id)

            results.append(
                {
                    "synonym": gene_name,
                    "geneId": gene_id,
                    "gene": {
                        "name": gene_name,
                        "full_name": full_name or gene_name,
                    },
                    "link": ncbi_url.base_URL.format(gene_id),
                }
            )

        current_app.logger.info(
            f"Mozg NCBI gene matching time {time.time() - start:.2f}s",
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return results

    # ------------------------------------------------------------------
    # Enrichment-domain lookups
    # ------------------------------------------------------------------

    def get_uniprot_genes(
        self, gene_ids: List[int]
    ) -> Dict[int, Dict[str, Any]]:
        """Look up UniProt functional annotations by NCBI gene ID.

        Queries https://rest.uniprot.org via Mozg.
        """
        start = time.time()

        domain = self.session.query(DomainURLsMap).filter(
            DomainURLsMap.domain == "uniprot"
        ).one_or_none()
        if domain is None:
            raise ServerException(
                title="Could not create enrichment table",
                message="There was a problem finding UniProt domain URLs.",
            )

        output: Dict[int, Dict[str, Any]] = {}
        for gene_id in gene_ids:
            rows = run_query(
                connection=UNIPROT_CONNECTION,
                from_entity="uniprotkb",
                where={
                    "query": f"xref:GeneID-{gene_id}",
                    "fields": "accession,cc_function",
                },
                limit=1,
            )
            entry = _parse_uniprot_entry(rows)
            if entry:
                output[gene_id] = {
                    "result": {
                        "id": entry["accession"],
                        "function": entry.get("function", ""),
                    },
                    "link": domain.base_URL.format(entry["accession"]),
                }

        current_app.logger.info(
            f"Mozg UniProt enrichment time {time.time() - start:.2f}s",
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return output

    def get_string_genes(
        self, gene_ids: List[int]
    ) -> Dict[int, Dict[str, Any]]:
        """Look up STRING protein-interaction data by NCBI gene ID.

        Queries https://string-db.org/api via Mozg.
        """
        start = time.time()

        output: Dict[int, Dict[str, Any]] = {}
        for gene_id in gene_ids:
            # Resolve gene ID to STRING identifier
            resolve_rows = run_query(
                connection=STRING_CONNECTION,
                from_entity="get_string_ids",
                where={"identifiers": str(gene_id), "format": "json"},
                limit=1,
            )
            string_id = _extract_string_id(resolve_rows)
            if string_id is None:
                continue

            # Fetch functional annotation
            annot_rows = run_query(
                connection=STRING_CONNECTION,
                from_entity="annotations",
                where={"identifiers": string_id, "format": "json"},
                limit=1,
            )
            annotation = _extract_string_annotation(annot_rows)
            output[gene_id] = {
                "result": {"id": string_id, "annotation": annotation or ""},
                "link": f"https://string-db.org/cgi/network?identifiers={string_id}",
            }

        current_app.logger.info(
            f"Mozg STRING enrichment time {time.time() - start:.2f}s",
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return output

    def get_biocyc_genes(
        self, gene_ids: List[int], tax_id: str
    ) -> Dict[int, Dict[str, Any]]:
        """Look up BioCyc pathway data by NCBI gene ID.

        Queries the BioCyc web-services API via Mozg.
        """
        start = time.time()

        org_id = BIOCYC_ORG_ID_DICT.get(tax_id)
        biocyc_connection = {
            "driver": "biocyc",
            "database": org_id if org_id else "META",
        }

        output: Dict[int, Dict[str, Any]] = {}
        for gene_id in gene_ids:
            rows = run_query(
                connection=biocyc_connection,
                from_entity="genes",
                where={"ncbi_gene_id": str(gene_id)},
                limit=1,
            )
            entry = _parse_biocyc_entry(rows)
            if entry is None:
                continue
            biocyc_id = entry.get("biocyc_id", "")
            pathways = entry.get("pathways", [])
            if org_id:
                link = (
                    f"https://biocyc.org/gene?orgid={org_id}&id={biocyc_id}"
                )
            else:
                link = f"https://biocyc.org/gene?id={biocyc_id}"
            output[gene_id] = {"result": pathways, "link": link}

        current_app.logger.info(
            f"Mozg BioCyc enrichment time {time.time() - start:.2f}s",
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return output

    def get_go_genes(
        self, gene_ids: List[int]
    ) -> Dict[int, Dict[str, Any]]:
        """Look up Gene Ontology terms by NCBI gene ID.

        Queries the EBI QuickGO REST API via Mozg.
        """
        start = time.time()

        output: Dict[int, Dict[str, Any]] = {}
        for gene_id in gene_ids:
            # QuickGO accepts NCBI gene product IDs with the 'NCBIGene:' prefix
            rows = run_query(
                connection=GO_CONNECTION,
                from_entity="annotation",
                where={
                    "geneProductId": f"NCBIGene:{gene_id}",
                    "fields": "goId,goName",
                },
                limit=100,
            )
            go_terms = _extract_go_terms(rows)
            output[gene_id] = {
                "result": go_terms,
                "link": "https://www.ebi.ac.uk/QuickGO/annotations?geneProductId=",
            }

        current_app.logger.info(
            f"Mozg GO enrichment time {time.time() - start:.2f}s",
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return output

    def get_regulon_genes(
        self, gene_ids: List[int]
    ) -> Dict[int, Dict[str, Any]]:
        """Look up RegulonDB data by NCBI gene ID.

        Queries the RegulonDB web-services API via Mozg.
        """
        start = time.time()

        output: Dict[int, Dict[str, Any]] = {}
        for gene_id in gene_ids:
            rows = run_query(
                connection=REGULONDB_CONNECTION,
                from_entity="gene/genes_by_ncbi_id",
                where={"ncbiGeneId": str(gene_id)},
                limit=1,
            )
            entry = _parse_regulon_entry(rows)
            if entry is None:
                continue
            regulon_id = entry.get("regulondb_id", "")
            link = (
                f"http://regulondb.ccg.unam.mx/gene?"
                f"term={regulon_id}&organism=ECK12&format=jsp&type=gene"
            )
            output[gene_id] = {"result": entry, "link": link}

        current_app.logger.info(
            f"Mozg RegulonDB enrichment time {time.time() - start:.2f}s",
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return output

    def get_kegg_genes(
        self, gene_ids: List[int]
    ) -> Dict[int, Dict[str, Any]]:
        """Look up KEGG pathway data by NCBI gene ID.

        Queries the KEGG REST API via Mozg.
        """
        start = time.time()

        output: Dict[int, Dict[str, Any]] = {}
        for gene_id in gene_ids:
            # Convert NCBI gene ID to KEGG entry ID (hsa:NCBI_ID format for human etc.)
            link_rows = run_query(
                connection=KEGG_CONNECTION,
                from_entity="conv",
                where={"_pathSuffix": f"/ncbi-geneid/ncbi-geneid:{gene_id}"},
                limit=1,
            )
            kegg_id = _extract_kegg_id(link_rows)
            if kegg_id is None:
                continue

            pathway_rows = run_query(
                connection=KEGG_CONNECTION,
                from_entity="link",
                where={"_pathSuffix": f"/pathway/{kegg_id}"},
            )
            pathways = _extract_kegg_pathways(pathway_rows)
            output[gene_id] = {
                "result": pathways,
                "link": f"https://www.genome.jp/entry/{kegg_id}",
            }

        current_app.logger.info(
            f"Mozg KEGG enrichment time {time.time() - start:.2f}s",
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return output


class MozgEnrichmentTableService(MozgKgService):
    """Enrichment-table service backed by Mozg.

    Keeps the response schema compatible with the legacy Neo4j-based
    :class:`~neo4japp.services.enrichment.EnrichmentTableService` so
    that the API clients and annotation pipeline require no changes.

    The main difference: ``geneNeo4jId`` is now populated with the NCBI
    Gene UID instead of a Neo4j internal node ID.  Both are integers, so
    the downstream enrichment-domain endpoint continues to work without
    modification.
    """

    def match_ncbi_genes(
        self, gene_names: List[str], organism: str
    ) -> List[Dict[str, Any]]:
        """Match gene names using NCBI E-utilities via Mozg.

        Returns records in the same shape as the legacy Neo4j implementation
        with one change: ``geneNeo4jId`` / ``synonymNeo4jId`` now contain the
        NCBI Gene UID (integer) rather than a Neo4j internal node ID.
        """
        mozg_results = super().match_ncbi_genes(gene_names, organism)
        return [
            {
                "gene": r["gene"],
                "synonym": r["synonym"],
                # Use NCBI gene ID in place of the former Neo4j internal ID
                "geneNeo4jId": r["geneId"],
                "synonymNeo4jId": r["geneId"],
                "link": r["link"],
            }
            for r in mozg_results
        ]


# ---------------------------------------------------------------------------
# Response-parsing helpers
# ---------------------------------------------------------------------------

def _extract_ncbi_gene_id(rows: list) -> Optional[int]:
    """Extract the first NCBI gene UID from an esearch.fcgi response."""
    if not rows:
        return None
    # Mozg's REST driver returns the raw JSON; the structure varies.
    # esearch.fcgi with retmode=json returns:
    #   { "esearchresult": { "idlist": ["12345"] } }
    row = rows[0] if isinstance(rows, list) else rows
    try:
        id_list = row.get("esearchresult", {}).get("idlist", [])
        if id_list:
            return int(id_list[0])
    except (AttributeError, ValueError, TypeError):
        pass
    return None


def _extract_ncbi_gene_full_name(rows: list, gene_id: int) -> Optional[str]:
    """Extract the description/full-name from an esummary.fcgi response."""
    if not rows:
        return None
    row = rows[0] if isinstance(rows, list) else rows
    try:
        result = row.get("result", {})
        entry = result.get(str(gene_id), {})
        return entry.get("description") or entry.get("name")
    except (AttributeError, TypeError):
        return None


def _parse_uniprot_entry(rows: list) -> Optional[Dict[str, Any]]:
    """Extract accession and function from a UniProt REST response."""
    if not rows:
        return None
    # UniProt /uniprotkb returns { "results": [...] }
    row = rows[0] if isinstance(rows, list) else rows
    entries = []
    if isinstance(row, dict):
        entries = row.get("results", [row])
    if not entries:
        return None
    entry = entries[0]
    accession = entry.get("primaryAccession") or entry.get("accession", "")
    # Function comment is nested under comments → commentType == "FUNCTION"
    function_text = ""
    for comment in entry.get("comments", []):
        if comment.get("commentType") == "FUNCTION":
            texts = comment.get("texts", [])
            if texts:
                function_text = texts[0].get("value", "")
            break
    return {"accession": accession, "function": function_text}


def _extract_string_id(rows: list) -> Optional[str]:
    """Extract the STRING identifier from a get_string_ids response."""
    if not rows:
        return None
    row = rows[0] if isinstance(rows, list) else rows
    if isinstance(row, list) and row:
        row = row[0]
    if isinstance(row, dict):
        return row.get("stringId") or row.get("string_id")
    return None


def _extract_string_annotation(rows: list) -> Optional[str]:
    """Extract the annotation text from a STRING annotations response."""
    if not rows:
        return None
    row = rows[0] if isinstance(rows, list) else rows
    if isinstance(row, list) and row:
        row = row[0]
    if isinstance(row, dict):
        return row.get("annotation")
    return None


def _parse_biocyc_entry(rows: list) -> Optional[Dict[str, Any]]:
    """Extract BioCyc gene ID and pathways from a BioCyc API response."""
    if not rows:
        return None
    row = rows[0] if isinstance(rows, list) else rows
    if isinstance(row, dict):
        return {
            "biocyc_id": row.get("id", ""),
            "pathways": row.get("pathways", []),
        }
    return None


def _extract_go_terms(rows: list) -> List[str]:
    """Extract GO term names from an EBI QuickGO annotation response."""
    if not rows:
        return []
    # QuickGO annotation returns { "results": [{ "goId": "GO:...", ... }] }
    row = rows[0] if isinstance(rows, list) else rows
    if isinstance(row, dict):
        results = row.get("results", [])
        return [r.get("goName", r.get("goId", "")) for r in results if r]
    return []


def _parse_regulon_entry(rows: list) -> Optional[Dict[str, Any]]:
    """Extract RegulonDB gene record from a RegulonDB API response."""
    if not rows:
        return None
    row = rows[0] if isinstance(rows, list) else rows
    if isinstance(row, list) and row:
        row = row[0]
    if isinstance(row, dict):
        return {
            "regulondb_id": row.get("regulonId", row.get("id", "")),
            **row,
        }
    return None


def _extract_kegg_id(rows: list) -> Optional[str]:
    """Extract the KEGG entry ID from a KEGG conv response."""
    if not rows:
        return None
    # KEGG conv returns TSV-like data; Mozg's kegg driver converts it to JSON
    row = rows[0] if isinstance(rows, list) else rows
    if isinstance(row, dict):
        # The kegg driver typically returns { from: "...", to: "kegg_id" }
        return row.get("to") or row.get("kegg_id")
    return None


def _extract_kegg_pathways(rows: list) -> List[str]:
    """Extract pathway names from a KEGG link response."""
    pathways = []
    for row in rows:
        if isinstance(row, dict):
            name = row.get("name") or row.get("to", "")
            if name:
                pathways.append(name)
    return pathways
