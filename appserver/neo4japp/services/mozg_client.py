"""Mozg GraphQL client.

Mozg (https://github.com/Skitionek/Mozg) is a cross-database GraphQL query
layer that replaces the local Neo4j knowledge graph for enrichment data
queries.  Python services talk to the single /graphql endpoint; Mozg routes
each query to the appropriate upstream database or REST API.
"""

import os
from typing import Any, Dict, List, Optional

import requests

MOZG_URL = os.getenv("MOZG_URL", "http://mozg:4000/graphql")

# ---------------------------------------------------------------------------
# Pre-defined connection descriptors for upstream biological databases
# ---------------------------------------------------------------------------

NCBI_CONNECTION: Dict[str, Any] = {
    "driver": "rest",
    "database": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
}

UNIPROT_CONNECTION: Dict[str, Any] = {
    "driver": "rest",
    "database": "https://rest.uniprot.org",
}

STRING_CONNECTION: Dict[str, Any] = {
    "driver": "rest",
    "database": "https://string-db.org/api/json",
}

KEGG_CONNECTION: Dict[str, Any] = {
    "driver": "kegg",
    "database": "https://rest.kegg.jp",
}

GO_CONNECTION: Dict[str, Any] = {
    "driver": "rest",
    "database": "https://www.ebi.ac.uk/QuickGO/services",
}

BIOCYC_CONNECTION: Dict[str, Any] = {
    "driver": "biocyc",
    "database": "META",
}

REGULONDB_CONNECTION: Dict[str, Any] = {
    "driver": "rest",
    "database": "https://regulondb.ccg.unam.mx/webservices",
}

# ---------------------------------------------------------------------------
# Core helper
# ---------------------------------------------------------------------------

_QUERY_GQL = """
query MozgQuery($input: QueryInput!) {
    query(input: $input) {
        data
        count
    }
}
"""


def run_query(
    connection: Dict[str, Any],
    from_entity: str,
    where: Optional[Dict[str, Any]] = None,
    limit: Optional[int] = None,
    select: Optional[List[str]] = None,
    timeout: int = 30,
) -> List[Any]:
    """Execute a query through the Mozg GraphQL endpoint.

    Returns the *data* array from the response.  Raises :class:`RuntimeError`
    when Mozg reports GraphQL errors, and :class:`requests.HTTPError` for
    non-2xx HTTP responses.
    """
    input_obj: Dict[str, Any] = {
        "connection": connection,
        "from": from_entity,
    }
    if where is not None:
        input_obj["where"] = where
    if limit is not None:
        input_obj["limit"] = limit
    if select is not None:
        input_obj["select"] = select

    response = requests.post(
        MOZG_URL,
        json={"query": _QUERY_GQL, "variables": {"input": input_obj}},
        timeout=timeout,
    )
    response.raise_for_status()
    body = response.json()
    if "errors" in body:
        raise RuntimeError(f"Mozg query error: {body['errors']}")

    data = body.get("data", {}).get("query", {}).get("data", [])
    if isinstance(data, list):
        return data
    if data is not None:
        return [data]
    return []
