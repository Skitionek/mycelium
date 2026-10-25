"""Unit tests for the Mozg GraphQL transport."""
import pytest
import requests

from neo4japp.services import mozg_client
from neo4japp.services.mozg_client import MozgQueryError, run_query

CONNECTION = {'driver': 'rest', 'database': 'https://example.test'}


class FakeResponse:
    def __init__(self, body, status_code=200):
        self._body = body
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f'{self.status_code} from Mozg')

    def json(self):
        return self._body


@pytest.fixture
def answer(monkeypatch):
    """Make Mozg answer with ``body``; return the recorded request inputs."""
    monkeypatch.setenv('MOZG_URL', 'http://mozg.test/graphql')
    inputs = []

    def install(body, status_code=200):
        def post(url, json=None, timeout=None):
            inputs.append(json['variables']['input'])
            return FakeResponse(body, status_code)

        monkeypatch.setattr(mozg_client.requests, 'post', post)
        return inputs

    return install


def test_returns_the_rows(answer):
    answer({'data': {'query': {'data': [{'a': 1}], 'count': 1}}})

    assert run_query(CONNECTION, '/x') == [{'a': 1}]


def test_wraps_a_single_row_in_a_list(answer):
    answer({'data': {'query': {'data': {'a': 1}, 'count': 1}}})

    assert run_query(CONNECTION, '/x') == [{'a': 1}]


@pytest.mark.parametrize(
    'body',
    [
        {'data': {'query': {'data': None}}},
        {'data': {'query': None}},
        {'data': None},
        {},
    ],
)
def test_answers_no_rows_for_an_empty_result(answer, body):
    answer(body)

    assert run_query(CONNECTION, '/x') == []


def test_raises_on_graphql_errors(answer):
    answer({'errors': [{'message': 'upstream said no'}], 'data': None})

    with pytest.raises(MozgQueryError, match='upstream said no'):
        run_query(CONNECTION, '/x')


def test_raises_on_a_non_2xx_answer(answer):
    answer({}, status_code=502)

    with pytest.raises(requests.HTTPError):
        run_query(CONNECTION, '/x')


def test_sends_optional_arguments_only_when_given(answer):
    inputs = answer({'data': {'query': {'data': []}}})

    run_query(CONNECTION, '/x')
    run_query(CONNECTION, '/x', where={'a': '1'}, select=['b'], limit=5)

    assert inputs[0] == {'connection': CONNECTION, 'from': '/x'}
    assert inputs[1]['where'] == {'a': '1'}
    assert inputs[1]['select'] == ['b']
    assert inputs[1]['limit'] == 5
