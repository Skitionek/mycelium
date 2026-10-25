"""Unit tests for the Mozg GraphQL transport."""

import pytest
import requests

from statistical_enrichment.services import mozg_client
from statistical_enrichment.services.mozg_client import MozgQueryError, run_query

CONNECTION = mozg_client.QUICKGO_CONNECTION


class FakeResponse:
    def __init__(self, body, status_code=200):
        self._body = body
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} from Mozg")

    def json(self):
        return self._body


@pytest.fixture
def answer(monkeypatch):
    """Make Mozg answer with ``body``; return the recorded requests."""
    monkeypatch.setenv("MOZG_URL", "http://mozg.test/graphql")
    calls = []

    def install(body, status_code=200):
        def post(url, json=None, timeout=None):
            calls.append({"url": url, "json": json, "timeout": timeout})
            return FakeResponse(body, status_code)

        monkeypatch.setattr(mozg_client.requests, "post", post)
        return calls

    return install


def test_returns_the_rows(answer):
    answer({"data": {"query": {"data": [{"a": 1}, {"a": 2}], "count": 2}}})

    assert run_query(CONNECTION, "/annotation/search") == [{"a": 1}, {"a": 2}]


def test_wraps_a_single_row_in_a_list(answer):
    answer({"data": {"query": {"data": {"a": 1}, "count": 1}}})

    assert run_query(CONNECTION, "/annotation/stats") == [{"a": 1}]


@pytest.mark.parametrize(
    "body",
    [
        {"data": {"query": {"data": None, "count": 0}}},
        {"data": {"query": None}},
        {"data": None},
        {},
    ],
)
def test_answers_no_rows_for_an_empty_result(answer, body):
    answer(body)

    assert run_query(CONNECTION, "/annotation/search") == []


def test_raises_on_graphql_errors(answer):
    answer({"errors": [{"message": "upstream said no"}], "data": None})

    with pytest.raises(MozgQueryError, match="upstream said no"):
        run_query(CONNECTION, "/annotation/search")


def test_raises_on_a_non_2xx_answer(answer):
    answer({}, status_code=502)

    with pytest.raises(requests.HTTPError):
        run_query(CONNECTION, "/annotation/search")


def test_sends_where_and_select_only_when_given(answer):
    calls = answer({"data": {"query": {"data": []}}})

    run_query(CONNECTION, "/annotation/search")
    run_query(CONNECTION, "/annotation/search", where={"goId": "GO:1"}, select=["symbol"])

    bare, full = (call["json"]["variables"]["input"] for call in calls)
    assert bare == {"connection": CONNECTION, "from": "/annotation/search"}
    assert full["where"] == {"goId": "GO:1"}
    assert full["select"] == ["symbol"]


def test_posts_to_the_configured_endpoint_with_the_timeout(answer):
    calls = answer({"data": {"query": {"data": []}}})

    run_query(CONNECTION, "/annotation/stats", timeout=120)

    assert calls[0]["url"] == "http://mozg.test/graphql"
    assert calls[0]["timeout"] == 120
