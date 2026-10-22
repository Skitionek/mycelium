"""Client for the Mozg GraphQL query layer.

Mozg (https://github.com/Skitionek/Mozg) serves a single ``/graphql``
endpoint and forwards each query to an upstream database or REST API at
request time.  It stands in for the pre-loaded Neo4j copies of NCBI Gene,
UniProt, STRING, KEGG and GO that ``graph-db`` used to build.

Every Mozg query carries its own connection, so the descriptors below mirror
the matching entry in Mozg's catalog (``{ catalog(name: "uniprot") { … } }``).
Keeping the base URLs identical means a query that works in Mozg's own query
builder works here unchanged.

Three properties of Mozg's drivers shape how callers build a query:

* The ``rest`` driver turns ``from`` into the URL path and every ``where``
  key into a query parameter.  ``limit`` is *not* one of them -- it is sent
  as ``_limit``, a JSONPlaceholder convention that none of the APIs below
  understand.  Paging therefore belongs in ``where`` under whatever name the
  upstream uses: ``retmax`` for NCBI, ``size`` for UniProt, ``limit`` for
  QuickGO.
* A response body that is an object holding a ``data``, ``results``,
  ``items``, ``records``, ``list`` or ``entries`` array is unwrapped one
  level, so UniProt's ``{"results": [...]}`` arrives here as the entry list
  itself, while NCBI's ``{"esearchresult": {...}}`` arrives as a single row.
* The ``kegg`` driver has no query string at all.  It takes its one argument
  as a path segment via ``where['_pathSuffix']`` and its ``limit`` really
  does slice the parsed rows.

Every upstream here accepts a batch of identifiers in a single request, so
callers should resolve a whole gene list per query rather than looping; see
:mod:`neo4japp.services.mozg_kg_service`.
"""

import os
from typing import Any, Dict, List, Optional

import requests

# Mirrors Mozg catalog entry "ncbi". Needs retmode=json; every endpoint
# otherwise answers XML.
NCBI_CONNECTION: Dict[str, Any] = {
    'driver': 'rest',
    'database': 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
}

# Mirrors Mozg catalog entry "uniprot". The bare /uniprotkb path answers a
# 301 to a port Mozg cannot follow, so queries must use /uniprotkb/search.
UNIPROT_CONNECTION: Dict[str, Any] = {
    'driver': 'rest',
    'database': 'https://rest.uniprot.org',
    'headers': {'Accept': 'application/json'},
}

# Mirrors Mozg catalog entry "string-db". The base URL already selects the
# JSON output format, so the method name is the whole path.
STRING_CONNECTION: Dict[str, Any] = {
    'driver': 'rest',
    'database': 'https://string-db.org/api/json',
}

# Mirrors Mozg catalog entry "kegg".
KEGG_CONNECTION: Dict[str, Any] = {
    'driver': 'kegg',
    'database': 'https://rest.kegg.jp',
}

# QuickGO has no Mozg catalog entry and is reached as a plain REST source.
# Mozg does catalogue api.geneontology.org as "geneontology", but that API
# has no organism-wide annotation search and exposes no gene symbols, both of
# which the enrichment table needs. QuickGO was also where graph-db sourced
# its GO data, and the enrichment table still links back to it.
QUICKGO_CONNECTION: Dict[str, Any] = {
    'driver': 'rest',
    'database': 'https://www.ebi.ac.uk/QuickGO/services',
    'headers': {'Accept': 'application/json'},
}

_QUERY_GQL = """
query MozgQuery($input: QueryInput!) {
    query(input: $input) {
        data
        count
    }
}
"""


class MozgQueryError(RuntimeError):
    """Mozg answered, but reported an error instead of rows.

    Mozg masks upstream failures as a generic GraphQL error and logs the
    detail server-side, so the message here names the query rather than the
    cause. Callers that query one upstream per enrichment domain catch this
    and drop that domain rather than failing the whole request.
    """


def get_mozg_url() -> str:
    """Endpoint Mozg is served from, or an empty string when unconfigured.

    Read per call rather than at import time so that the Neo4j/Mozg choice in
    :func:`neo4japp.database.get_kg_service` and this module can never
    disagree about whether Mozg is in use.
    """
    return os.getenv('MOZG_URL', '')


def run_query(
    connection: Dict[str, Any],
    from_entity: str,
    where: Optional[Dict[str, Any]] = None,
    select: Optional[List[str]] = None,
    limit: Optional[int] = None,
    timeout: int = 30,
) -> List[Any]:
    """Execute one Mozg ``query`` and return its ``data`` rows.

    :param connection: one of the ``*_CONNECTION`` descriptors above.
    :param from_entity: entity to query; the URL path for REST and KEGG
        sources, which Mozg prefixes with ``/`` when it is missing.
    :param where: filter conditions, passed to REST sources as query
        parameters and to the KEGG driver as ``_pathSuffix``.
    :param select: columns to keep; Mozg drops the rest from each row.
    :param limit: Mozg's row limit. Meaningful for the KEGG driver, which
        slices its parsed rows; see the module docstring for why REST sources
        need an upstream-specific paging parameter in ``where`` instead.
    :raises MozgQueryError: Mozg reported GraphQL errors.
    :raises requests.RequestException: Mozg was unreachable or answered non-2xx.
    """
    query_input: Dict[str, Any] = {'connection': connection, 'from': from_entity}
    if where is not None:
        query_input['where'] = where
    if select is not None:
        query_input['select'] = select
    if limit is not None:
        query_input['limit'] = limit

    response = requests.post(
        get_mozg_url(),
        json={'query': _QUERY_GQL, 'variables': {'input': query_input}},
        timeout=timeout,
    )
    response.raise_for_status()
    body = response.json()

    if body.get('errors'):
        raise MozgQueryError(
            f"Mozg could not answer {from_entity} on {connection['database']}: "
            f"{body['errors']}"
        )

    rows = (body.get('data') or {}).get('query', {}).get('data')
    if isinstance(rows, list):
        return rows
    if rows is None:
        return []
    return [rows]
