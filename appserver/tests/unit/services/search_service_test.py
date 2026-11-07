"""Lucene query building for the organism search."""
from unittest.mock import MagicMock

import pytest

from neo4japp.services.search import SearchService


@pytest.fixture
def graph():
    graph = MagicMock()
    graph.execute_read.return_value = []
    return graph


def lucene_query_for(graph, term):
    SearchService(graph).get_organisms(term, limit=10)
    _, query, _ = graph.execute_read.call_args.args
    return query


@pytest.mark.parametrize('term, query', [
    ('homo', '`homo`'),
    ('homo sapiens', '`homo AND sapiens`'),
    ('  homo sapiens  ', '`homo AND sapiens`'),
    ('homo  sapiens', '`homo AND sapiens`'),
    ('homo\tsapiens', '`homo AND sapiens`'),
    ('e. coli k-12', r'`e. AND coli AND k\-12`'),
    ('a(b)', r'`a\(b\)`'),
    ('back\\slash', r'`back\\slash`'),
    ('trailing\\', r'`trailing\\`'),
    ('tick`name', '`tick``name`'),
])
def test_builds_a_lucene_query_of_all_words(graph, term, query):
    assert lucene_query_for(graph, term) == query


def test_every_backslash_is_escaped(graph):
    """A lone backslash escapes the next character, or ends the query in error."""
    query = lucene_query_for(graph, 'a\\b\\')

    assert query.count('\\') == 4


@pytest.mark.parametrize('term', ['', '   ', '\t'])
def test_blank_search_queries_nothing(graph, term):
    result = SearchService(graph).get_organisms(term, limit=10)

    assert result['nodes'] == []
    graph.execute_read.assert_not_called()
