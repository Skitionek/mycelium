"""Knowledge-graph service backed by Mozg.

Stands in for the enrichment lookups :class:`~neo4japp.services.KgService`
answered from a local Neo4j copy of the biological databases.  Each method
here queries the canonical upstream API through Mozg instead, at request
time.  The public API matches ``KgService`` so the blueprints and the stored
enrichment-table format are unchanged.

Two differences from the Neo4j original are visible to callers:

* ``geneNeo4jId`` and ``synonymNeo4jId`` carry the NCBI Gene UID rather than
  a Neo4j internal node id.  Both are integers, and the enrichment-domain
  endpoint only ever echoes them back as lookup keys.
* ``get_biocyc_genes`` and ``get_regulon_genes`` return nothing.  Neither
  upstream can be reached: BioCyc's public web service answers programmatic
  requests with a captcha page unless the caller holds a subscription, and
  regulondb.ccg.unam.mx serves an incomplete TLS chain that Mozg's HTTP
  client rejects.  See ``mozg/README.md``.

Every upstream used here accepts a batch of identifiers in one request, so a
whole gene list costs a fixed handful of queries rather than one per gene --
which also keeps NCBI's three-requests-per-second limit out of reach.
"""

import time
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence

import requests
from flask import current_app

from neo4japp.constants import LogEventType
from neo4japp.exceptions import ServerException
from neo4japp.models import DomainURLsMap
from neo4japp.services.enrichment.data_transfer_objects import EnrichmentCellTextMapping
from neo4japp.services.enrichment.enrichment_table import EnrichmentTableService
from neo4japp.utils.logger import EventLog

from .mozg_client import (
    KEGG_CONNECTION,
    NCBI_CONNECTION,
    QUICKGO_CONNECTION,
    STRING_CONNECTION,
    UNIPROT_CONNECTION,
    MozgQueryError,
    run_query,
)

# NCBI answers a batched esearch from one URL, so the batch size is bounded by
# URL length rather than by the API. 25 names and 200 candidate UIDs keep both
# the search and the follow-up esummary well inside the usual 2 KB ceiling.
_NCBI_SEARCH_BATCH_SIZE = 25
_NCBI_SEARCH_RETMAX = 200
_NCBI_SUMMARY_BATCH_SIZE = 100

# UniProt caps a page at 500 entries; one chunk of gene ids must fit in one page.
_UNIPROT_BATCH_SIZE = 50
_UNIPROT_PAGE_SIZE = 500

_STRING_BATCH_SIZE = 100

# KEGG documents ten database entries as the maximum for a multi-entry request.
_KEGG_BATCH_SIZE = 10

# Matches the link the Neo4j-backed service produced for the GO domain.
_QUICKGO_ANNOTATIONS_URL = 'https://www.ebi.ac.uk/QuickGO/annotations?geneProductId='


class MozgKgService:
    """Enrichment lookups answered by upstream APIs through Mozg.

    :param session: SQLAlchemy session, still needed for the
        :class:`DomainURLsMap` link templates held in the relational database.
    """

    def __init__(self, session):
        self.session = session

    # ------------------------------------------------------------------
    # NCBI gene matching
    # ------------------------------------------------------------------

    def match_ncbi_genes(self, gene_names: List[str], organism: str) -> List[Dict[str, Any]]:
        """Match gene names against NCBI Gene for one organism.

        Returns one record per matched name, in the order the names were
        given, with the keys the Neo4j implementation produced: ``synonym``,
        ``geneId``, ``gene`` and ``link``.
        """
        start = time.time()
        ncbi_domain = self._domain_url('NCBI_Gene')

        candidate_ids: List[int] = []
        for chunk in _chunks(gene_names, _NCBI_SEARCH_BATCH_SIZE):
            candidate_ids.extend(self._search_ncbi_gene_ids(chunk, organism))
        candidate_ids = list(dict.fromkeys(candidate_ids))

        summaries: Dict[str, Dict[str, Any]] = {}
        for chunk in _chunks(candidate_ids, _NCBI_SUMMARY_BATCH_SIZE):
            summaries.update(self._fetch_ncbi_gene_summaries(chunk))

        results = []
        for gene_name in gene_names:
            summary = _match_gene_summary(summaries, candidate_ids, gene_name)
            if summary is None:
                continue
            gene_id = int(summary['uid'])
            results.append(
                {
                    'synonym': gene_name,
                    'geneId': gene_id,
                    'gene': {
                        'name': summary.get('name') or gene_name,
                        'full_name': summary.get('description') or gene_name,
                    },
                    'link': ncbi_domain.base_URL.format(gene_id),
                }
            )

        self._log_timing('NCBI gene matching', start)
        return results

    def _search_ncbi_gene_ids(self, gene_names: Sequence[str], organism: str) -> List[int]:
        """Collect candidate NCBI gene UIDs for a batch of names.

        ``[Gene Name]`` covers both the official symbol and its aliases, which
        is the closest equivalent of the ``Synonym`` nodes the Neo4j query
        walked. The field names matter: NCBI silently reinterprets an
        unrecognised qualifier such as ``[gene_name]`` as ``[All Fields]`` and
        then answers with thousands of loosely related genes.

        The organism filter has to explode the taxonomy subtree.
        Mycelium identifies organisms at species level, while NCBI files genes
        under the strain -- E. coli K-12 genes are taxon 511145, not the 83333
        that reaches us -- so the exact ``[Taxonomy ID]`` field finds nothing
        for them.

        Names are quoted because they come from a user's spreadsheet. NCBI
        tokenises an unquoted term, so a stray space makes ``TP 53`` match
        TP53, and a stray bracket or parenthesis changes the shape of the
        query around it.
        """
        quotable = [name for name in gene_names if '"' not in name]
        if not quotable:
            return []

        terms = ' OR '.join(f'"{gene_name}"[Gene Name]' for gene_name in quotable)
        rows = self._query(
            NCBI_CONNECTION,
            '/esearch.fcgi',
            'NCBI Gene',
            where={
                'db': 'gene',
                'term': f'({terms}) AND txid{organism}[Organism:exp]',
                'retmode': 'json',
                'retmax': str(_NCBI_SEARCH_RETMAX),
            },
        )
        if not rows:
            return []

        id_list = (rows[0].get('esearchresult') or {}).get('idlist') or []
        return [int(uid) for uid in id_list if str(uid).isdigit()]

    def _fetch_ncbi_gene_summaries(
        self, gene_ids: Sequence[int]
    ) -> Dict[str, Dict[str, Any]]:
        """Fetch gene summaries, keyed by UID as returned by esummary."""
        rows = self._query(
            NCBI_CONNECTION,
            '/esummary.fcgi',
            'NCBI Gene',
            where={
                'db': 'gene',
                'id': ','.join(str(gene_id) for gene_id in gene_ids),
                'retmode': 'json',
            },
            select=['result'],
        )
        if not rows:
            return {}

        result = rows[0].get('result') or {}
        # esummary lists the UIDs it answered for alongside the records.
        return {
            uid: summary
            for uid, summary in result.items()
            if uid != 'uids' and isinstance(summary, dict)
        }

    # ------------------------------------------------------------------
    # Enrichment-domain lookups
    # ------------------------------------------------------------------

    def get_uniprot_genes(self, ncbi_gene_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """Look up UniProt accessions and function comments by NCBI gene id."""
        start = time.time()
        domain = self._domain_url('uniprot')

        entries = self._fetch_uniprot_entries(ncbi_gene_ids)
        output = {
            gene_id: {
                'result': {'id': entry['accession'], 'function': entry['function']},
                'link': domain.base_URL.format(entry['accession']),
            }
            for gene_id, entry in entries.items()
        }

        self._log_timing('UniProt enrichment', start)
        return output

    def get_string_genes(self, ncbi_gene_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """Look up STRING identifiers and annotations by NCBI gene id."""
        start = time.time()

        output: Dict[int, Dict[str, Any]] = {}
        for chunk in _chunks(ncbi_gene_ids, _STRING_BATCH_SIZE):
            rows = self._query(
                STRING_CONNECTION,
                '/get_string_ids',
                'STRING',
                # STRING takes a carriage-return separated list and echoes each
                # input back as queryItem, which is what maps a row to its gene.
                where={'identifiers': '\r'.join(str(gene_id) for gene_id in chunk)},
                select=['queryItem', 'stringId', 'annotation'],
            )
            for row in rows:
                gene_id = _as_gene_id(row.get('queryItem'))
                string_id = row.get('stringId')
                if gene_id is None or not string_id:
                    continue
                output[gene_id] = {
                    'result': {'id': string_id, 'annotation': row.get('annotation') or ''},
                    'link': f'https://string-db.org/cgi/network?identifiers={string_id}',
                }

        self._log_timing('STRING enrichment', start)
        return output

    def get_go_genes(self, ncbi_gene_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """Look up GO term names by NCBI gene id.

        QuickGO is keyed by gene product, not by gene, so each NCBI gene id is
        first resolved to a UniProt accession. Genes without a UniProt entry
        therefore carry no GO terms here, where the Neo4j graph could still
        hold a ``GO_LINK`` for them.

        Terms come from QuickGO's first page of annotations per gene, so a gene
        annotated more than a hundred times keeps the terms QuickGO ranks
        highest rather than all of them.
        """
        start = time.time()

        uniprot_entries = self._fetch_uniprot_entries(ncbi_gene_ids)
        gene_ids_by_accession: Dict[str, List[int]] = {}
        for gene_id, entry in uniprot_entries.items():
            gene_ids_by_accession.setdefault(entry['accession'], []).append(gene_id)

        output = {}
        for accession, gene_ids in gene_ids_by_accession.items():
            term_names = self._fetch_quickgo_term_names(accession)
            if not term_names:
                continue
            for gene_id in gene_ids:
                output[gene_id] = {
                    'result': term_names,
                    'link': _QUICKGO_ANNOTATIONS_URL,
                }

        self._log_timing('GO enrichment', start)
        return output

    def get_kegg_genes(self, ncbi_gene_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """Look up KEGG pathway names by NCBI gene id."""
        start = time.time()

        kegg_ids_by_gene: Dict[int, str] = {}
        for chunk in _chunks(ncbi_gene_ids, _KEGG_BATCH_SIZE):
            kegg_ids_by_gene.update(self._convert_to_kegg_ids(chunk))

        pathway_ids_by_kegg_id: Dict[str, List[str]] = {}
        for chunk in _chunks(list(dict.fromkeys(kegg_ids_by_gene.values())), _KEGG_BATCH_SIZE):
            for kegg_id, pathway_id in self._link_kegg_pathways(chunk):
                pathway_ids_by_kegg_id.setdefault(kegg_id, []).append(pathway_id)

        organism_codes = {kegg_id.split(':', 1)[0] for kegg_id in kegg_ids_by_gene.values()}
        pathway_names = self._fetch_kegg_pathway_names(organism_codes)

        output = {}
        for gene_id, kegg_id in kegg_ids_by_gene.items():
            pathway_ids = pathway_ids_by_kegg_id.get(kegg_id, [])
            output[gene_id] = {
                'result': [pathway_names.get(pid, pid) for pid in pathway_ids],
                'link': f'https://www.genome.jp/entry/{kegg_id}',
            }

        self._log_timing('KEGG enrichment', start)
        return output

    def get_biocyc_genes(
        self, ncbi_gene_ids: List[int], tax_id: str
    ) -> Dict[int, Dict[str, Any]]:
        """Always empty: BioCyc's web service is not reachable without a
        subscription, so there is nothing to answer with.

        Reported as a missing domain rather than an error so that an
        enrichment table requesting BioCyc alongside reachable domains still
        returns those.
        """
        current_app.logger.warning(
            'BioCyc enrichment skipped: the public web service requires a '
            'subscription and answers programmatic requests with a captcha page.',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return {}

    def get_regulon_genes(self, ncbi_gene_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """Always empty: RegulonDB serves an incomplete TLS certificate chain
        that Mozg's HTTP client refuses, so no request reaches it.

        Reported as a missing domain for the same reason as
        :meth:`get_biocyc_genes`.
        """
        current_app.logger.warning(
            'RegulonDB enrichment skipped: regulondb.ccg.unam.mx serves an '
            'incomplete TLS certificate chain, which Mozg rejects.',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )
        return {}

    # ------------------------------------------------------------------
    # Upstream queries
    # ------------------------------------------------------------------

    def _fetch_uniprot_entries(
        self, ncbi_gene_ids: Sequence[int]
    ) -> Dict[int, Dict[str, str]]:
        """Resolve NCBI gene ids to a UniProt accession and function comment.

        Reviewed (Swiss-Prot) entries are asked for first: an unfiltered
        search is just as likely to answer with an unreviewed TrEMBL record,
        which carries an accession but no curated function text. Only the gene
        ids left over cost a second, unfiltered query.
        """
        entries: Dict[int, Dict[str, str]] = {}
        for chunk in _chunks(ncbi_gene_ids, _UNIPROT_BATCH_SIZE):
            entries.update(self._search_uniprot(chunk, reviewed_only=True))

            unreviewed = [gene_id for gene_id in chunk if gene_id not in entries]
            if unreviewed:
                entries.update(self._search_uniprot(unreviewed, reviewed_only=False))
        return entries

    def _search_uniprot(
        self, ncbi_gene_ids: Sequence[int], reviewed_only: bool
    ) -> Dict[int, Dict[str, str]]:
        cross_references = ' OR '.join(
            f'xref:GeneID-{gene_id}' for gene_id in ncbi_gene_ids
        )
        query = f'({cross_references})'
        if reviewed_only:
            query = f'{query} AND reviewed:true'

        rows = self._query(
            UNIPROT_CONNECTION,
            '/uniprotkb/search',
            'UniProt',
            where={
                'query': query,
                # xref_geneid returns the GeneID cross-reference block, the
                # only thing tying an entry back to the gene id asked for.
                'fields': 'accession,cc_function,xref_geneid',
                'format': 'json',
                'size': str(_UNIPROT_PAGE_SIZE),
            },
        )

        requested = set(ncbi_gene_ids)
        entries: Dict[int, Dict[str, str]] = {}
        for row in rows:
            accession = row.get('primaryAccession')
            if not accession:
                continue
            entry = {'accession': accession, 'function': _uniprot_function_text(row)}
            for gene_id in _uniprot_gene_ids(row):
                if gene_id in requested and gene_id not in entries:
                    entries[gene_id] = entry
        return entries

    def _fetch_quickgo_term_names(self, accession: str) -> List[str]:
        """Distinct GO term names annotated to one UniProt accession.

        Asked of QuickGO's ``stats`` endpoint rather than ``search``: stats
        answers with each distinct GO term and its name in a single response,
        where ``search`` pages over raw annotations and spends most of a page
        repeating the same term for each source that asserted it.

        One request per gene. QuickGO can filter on several gene products at
        once, but it aggregates its statistics over the whole filter, so a
        batched call cannot say which term belongs to which gene.
        """
        rows = self._query(
            QUICKGO_CONNECTION,
            '/annotation/stats',
            'QuickGO',
            where={'geneProductId': f'UniProtKB:{accession}'},
        )

        term_names = []
        for value in _quickgo_distinct_values(rows, 'goId'):
            term_name = value.get('name') or value.get('key')
            if term_name:
                term_names.append(term_name)
        return term_names

    def _convert_to_kegg_ids(self, ncbi_gene_ids: Sequence[int]) -> Dict[int, str]:
        """Convert NCBI gene ids to KEGG gene ids, e.g. 7157 -> ``hsa:7157``."""
        sources = '+'.join(f'ncbi-geneid:{gene_id}' for gene_id in ncbi_gene_ids)
        rows = self._query(
            KEGG_CONNECTION,
            '/conv/genes',
            'KEGG',
            where={'_pathSuffix': sources},
        )

        # /conv answers two tab-separated columns, which the KEGG driver parses
        # under its generic entry_id/name names: the source id and its KEGG id.
        kegg_ids: Dict[int, str] = {}
        for row in rows:
            gene_id = _as_gene_id(str(row.get('entry_id') or '').removeprefix('ncbi-geneid:'))
            kegg_id = row.get('name')
            if gene_id is not None and kegg_id:
                kegg_ids[gene_id] = kegg_id
        return kegg_ids

    def _link_kegg_pathways(self, kegg_ids: Sequence[str]) -> List[tuple]:
        """Return ``(kegg gene id, pathway id)`` pairs for a batch of genes."""
        rows = self._query(
            KEGG_CONNECTION,
            '/link/pathway',
            'KEGG',
            where={'_pathSuffix': '+'.join(kegg_ids)},
        )

        pairs = []
        for row in rows:
            source_id = row.get('source_id')
            target_id = row.get('target_id')
            if not source_id or not target_id:
                continue
            # /link prefixes its pathway ids, e.g. path:hsa04110.
            pairs.append((source_id, target_id.removeprefix('path:')))
        return pairs

    def _fetch_kegg_pathway_names(self, organism_codes: Iterable[str]) -> Dict[str, str]:
        """Map pathway ids to names, one request per KEGG organism code.

        The Neo4j implementation returned pathway names, and ``/link`` only
        answers with ids, so the organism's pathway list supplies the names.
        """
        names: Dict[str, str] = {}
        for organism_code in organism_codes:
            rows = self._query(
                KEGG_CONNECTION,
                '/list/pathway',
                'KEGG',
                where={'_pathSuffix': organism_code},
            )
            for row in rows:
                pathway_id = row.get('entry_id')
                if pathway_id:
                    names[pathway_id] = row.get('name') or pathway_id
        return names

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    def _query(
        self,
        connection: Dict[str, Any],
        from_entity: str,
        upstream: str,
        where: Optional[Dict[str, Any]] = None,
        select: Optional[List[str]] = None,
    ) -> List[Any]:
        """Run a Mozg query, reporting a failed upstream to the user.

        Mozg masks the cause of an upstream failure, so the message names the
        database that could not be reached and leaves the detail to Mozg's own
        log and the chained exception.
        """
        try:
            return run_query(connection, from_entity, where=where, select=select)
        except (MozgQueryError, requests.RequestException) as error:
            raise ServerException(
                title='Could not create enrichment table',
                message=f'{upstream} could not be reached through Mozg.',
            ) from error

    def _domain_url(self, domain: str) -> DomainURLsMap:
        url_map = (
            self.session.query(DomainURLsMap)
            .filter(DomainURLsMap.domain == domain)
            .one_or_none()
        )
        if url_map is None:
            raise ServerException(
                title='Could not create enrichment table',
                message=f'There was a problem finding {domain} domain URLs.',
            )
        return url_map

    def _log_timing(self, description: str, start: float) -> None:
        current_app.logger.info(
            f'Mozg {description} time {time.time() - start:.2f}s',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict(),
        )


class MozgEnrichmentTableService(MozgKgService):
    """Enrichment-table service backed by Mozg.

    Keeps the response schema of the Neo4j-backed
    :class:`~neo4japp.services.enrichment.EnrichmentTableService` so that the
    API clients and the annotation pipeline need no changes.
    """

    def match_ncbi_genes(self, gene_names: List[str], organism: str) -> List[Dict[str, Any]]:
        """Match gene names, in the shape the enrichment table expects.

        ``geneNeo4jId`` and ``synonymNeo4jId`` both carry the NCBI Gene UID.
        The enrichment-domain endpoint uses them only as lookup keys, and they
        were already opaque integers to every caller.
        """
        matches = super().match_ncbi_genes(gene_names, organism)
        return [
            {
                'gene': match['gene'],
                'synonym': match['synonym'],
                'geneNeo4jId': match['geneId'],
                'synonymNeo4jId': match['geneId'],
                'link': match['link'],
            }
            for match in matches
        ]

    def create_annotation_mappings(self, enrichment: dict) -> EnrichmentCellTextMapping:
        """Reuse the Neo4j-backed implementation.

        It only reshapes the enrichment document into cell texts and never
        touches the graph, so there is nothing to port.
        """
        return EnrichmentTableService.create_annotation_mappings(self, enrichment)


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------

def _chunks(items: Sequence[Any], size: int) -> Iterator[Sequence[Any]]:
    """Split a sequence into consecutive chunks of at most ``size`` items."""
    items = list(items)
    for start in range(0, len(items), size):
        yield items[start:start + size]


def _as_gene_id(value: Any) -> Optional[int]:
    """Read an NCBI gene id out of a value an upstream echoed back."""
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _match_gene_summary(
    summaries: Dict[str, Dict[str, Any]],
    candidate_ids: Sequence[int],
    gene_name: str,
) -> Optional[Dict[str, Any]]:
    """Pick the NCBI gene a requested name refers to.

    ``[Gene Name]`` matches official symbols and aliases alike, so a batched
    search answers with a pool of candidates covering every name asked for.
    Mirroring the ``Synonym`` match the Neo4j query did, an official symbol
    beats an alias; within either, NCBI's own relevance order decides.
    """
    wanted = gene_name.casefold()
    alias_match = None

    for gene_id in candidate_ids:
        summary = summaries.get(str(gene_id))
        if summary is None:
            continue

        if (summary.get('name') or '').casefold() == wanted:
            return summary

        if alias_match is None:
            aliases = (summary.get('otheraliases') or '').split(',')
            if wanted in [alias.strip().casefold() for alias in aliases]:
                alias_match = summary

    return alias_match


def _uniprot_function_text(entry: Dict[str, Any]) -> str:
    """Read the FUNCTION comment out of a UniProtKB entry."""
    for comment in entry.get('comments') or []:
        if comment.get('commentType') != 'FUNCTION':
            continue
        texts = comment.get('texts') or []
        if texts:
            return texts[0].get('value') or ''
    return ''


def _uniprot_gene_ids(entry: Dict[str, Any]) -> List[int]:
    """Read the NCBI gene ids a UniProtKB entry cross-references."""
    gene_ids = []
    for cross_reference in entry.get('uniProtKBCrossReferences') or []:
        if cross_reference.get('database') != 'GeneID':
            continue
        gene_id = _as_gene_id(cross_reference.get('id'))
        if gene_id is not None:
            gene_ids.append(gene_id)
    return gene_ids


def _quickgo_distinct_values(rows: List[Any], field: str) -> List[Dict[str, Any]]:
    """Read one field's distinct values out of a QuickGO stats response.

    QuickGO groups its statistics by ``annotation`` and by ``geneProduct``,
    each listing the same distinct values for a field. ``annotation`` comes
    first and is enough; Mozg has already unwrapped the groups out of the
    response envelope.
    """
    for group in rows:
        if not isinstance(group, dict):
            continue
        for value_type in group.get('types') or []:
            if value_type.get('type') == field:
                return [
                    value
                    for value in value_type.get('values') or []
                    if isinstance(value, dict)
                ]
    return []
