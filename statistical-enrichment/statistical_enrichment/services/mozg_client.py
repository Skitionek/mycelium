"""Client for the Mozg GraphQL query layer.

Mirrors ``appserver/neo4japp/services/mozg_client.py``; see that module for
what the Mozg drivers do to a query.  The short version, for the two sources
this service needs:

* The ``rest`` driver makes ``from`` the URL path and every ``where`` key a
  query parameter.  ``limit`` is sent as ``_limit``, which neither UniProt nor
  QuickGO understands, so paging goes in ``where`` as ``size`` and ``limit``
  respectively.
* A response body holding a ``results`` array is unwrapped one level, so
  UniProt's ``{"results": [...]}`` and QuickGO's ``{"numberOfHits": …,
  "results": [...]}`` both arrive as their list of rows.
"""

import os
from typing import Any, Dict, List, Optional

import requests

# Mirrors Mozg catalog entry "uniprot". Queries must use /uniprotkb/search:
# the bare /uniprotkb path answers a 301 to a port Mozg cannot follow.
UNIPROT_CONNECTION: Dict[str, Any] = {
    "driver": "rest",
    "database": "https://rest.uniprot.org",
    "headers": {"Accept": "application/json"},
}

# QuickGO has no Mozg catalog entry and is reached as a plain REST source. It
# is where graph-db sourced the GO annotations this service used to read out of
# Neo4j.
QUICKGO_CONNECTION: Dict[str, Any] = {
    "driver": "rest",
    "database": "https://www.ebi.ac.uk/QuickGO/services",
    "headers": {"Accept": "application/json"},
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
    """Mozg answered, but reported an error instead of rows."""


def get_mozg_url() -> str:
    """Endpoint Mozg is served from, or an empty string when unconfigured."""
    return os.getenv("MOZG_URL", "")


def run_query(
    connection: Dict[str, Any],
    from_entity: str,
    where: Optional[Dict[str, Any]] = None,
    select: Optional[List[str]] = None,
    timeout: int = 30,
) -> List[Any]:
    """Execute one Mozg ``query`` and return its ``data`` rows.

    :raises MozgQueryError: Mozg reported GraphQL errors.
    :raises requests.RequestException: Mozg was unreachable or answered non-2xx.
    """
    query_input: Dict[str, Any] = {"connection": connection, "from": from_entity}
    if where is not None:
        query_input["where"] = where
    if select is not None:
        query_input["select"] = select

    response = requests.post(
        get_mozg_url(),
        json={"query": _QUERY_GQL, "variables": {"input": query_input}},
        timeout=timeout,
    )
    response.raise_for_status()
    body = response.json()

    if body.get("errors"):
        raise MozgQueryError(
            f"Mozg could not answer {from_entity} on "
            f"{connection['database']}: {body['errors']}"
        )

    rows = (body.get("data") or {}).get("query", {}).get("data")
    if isinstance(rows, list):
        return rows
    if rows is None:
        return []
    return [rows]
