"""Mozg GraphQL client for the statistical-enrichment service.

Thin wrapper around the Mozg /graphql endpoint – mirrors the equivalent
module in the appserver.
"""

import os
from typing import Any, Dict, List, Optional

import requests

MOZG_URL = os.getenv("MOZG_URL", "http://mozg:4000/graphql")

GO_CONNECTION: Dict[str, Any] = {
    "driver": "rest",
    "database": "https://www.ebi.ac.uk/QuickGO/services",
}

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
    timeout: int = 30,
) -> List[Any]:
    """Execute a query through the Mozg GraphQL endpoint."""
    input_obj: Dict[str, Any] = {
        "connection": connection,
        "from": from_entity,
    }
    if where is not None:
        input_obj["where"] = where
    if limit is not None:
        input_obj["limit"] = limit

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
