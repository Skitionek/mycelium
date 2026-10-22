from unittest.mock import MagicMock

import neo4j
import pytest

from statistical_enrichment.services.enrichment.enrichment_visualisation import (
    EnrichmentVisualisationService,
)

GO_TERM_ROWS = [
    {
        "goId": "GO:0008150",
        "goTerm": "biological_process",
        "goLabel": ["BiologicalProcess"],
        "geneNames": ["MAPK1", "PIK3CA"],
    }
]


def make_session():
    """
    A session double bound to the installed driver's Session API.

    The ``spec`` is the whole point: a bare MagicMock answers to any
    attribute, which is why calls to the removed ``read_transaction`` stayed
    green in CI while enrichment visualisation was broken in production.
    Binding the double to the real class makes that failure show up here.
    """
    return MagicMock(spec=neo4j.Session)


def make_session_running(transaction):
    """A session double that actually invokes the transaction function."""
    session = make_session()
    session.execute_read.side_effect = lambda fn, *args, **kwargs: fn(
        transaction, *args, **kwargs
    )
    return session


# ---------------------------------------------------------------------------
# query_go_term
# ---------------------------------------------------------------------------

def test_query_go_term_reads_through_execute_read():
    """query_go_term should go through the driver's execute_read API."""
    # Given a session that returns one GO term row
    session = make_session()
    session.execute_read.return_value = GO_TERM_ROWS
    service = EnrichmentVisualisationService(session)

    # When the GO term query runs
    result = service.query_go_term(9606, ["MAPK1"])

    # Then the rows come back via a single execute_read call
    assert result == GO_TERM_ROWS
    assert session.execute_read.call_count == 1


def test_query_go_term_runs_its_cypher_inside_the_transaction():
    """The transaction function should run the GO term cypher with its params."""
    # Given a transaction that reports the GO term rows
    transaction = MagicMock(spec=neo4j.ManagedTransaction)
    transaction.run.return_value.data.return_value = GO_TERM_ROWS
    session = make_session_running(transaction)
    service = EnrichmentVisualisationService(session)

    # When the GO term query runs
    result = service.query_go_term(9606, ["MAPK1"])

    # Then the cypher ran with the organism and gene names bound
    assert result == GO_TERM_ROWS
    cypher, params = transaction.run.call_args[0][0], transaction.run.call_args[1]
    assert "MATCH (g:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId})" in cypher
    assert params == {"taxId": 9606, "gene_names": ["MAPK1"]}


def test_query_go_term_raises_when_no_terms_are_found():
    """An empty result means the organism is unusable, so it should fail fast."""
    # Given a session that finds no GO terms
    session = make_session()
    session.execute_read.return_value = []
    service = EnrichmentVisualisationService(session)

    # When the GO term query runs
    # Then it raises naming the organism
    with pytest.raises(Exception, match="Could not find related GO terms"):
        service.query_go_term(9606, ["MAPK1"])


# ---------------------------------------------------------------------------
# query_go_term_count
# ---------------------------------------------------------------------------

def test_query_go_term_count_reads_through_execute_read():
    """query_go_term_count should go through the driver's execute_read API."""
    # Given a session that reports a GO term count
    session = make_session()
    session.execute_read.return_value = [{"go_count": 42}]
    service = EnrichmentVisualisationService(session)

    # When the count query runs
    count = service.query_go_term_count(9606)

    # Then the count is unwrapped from the single row
    assert count == 42
    assert session.execute_read.call_count == 1


def test_query_go_term_count_runs_its_cypher_inside_the_transaction():
    """The transaction function should run the count cypher with its params."""
    # Given a transaction that reports a single count row
    transaction = MagicMock(spec=neo4j.ManagedTransaction)
    transaction.run.return_value = [{"go_count": 42}]
    session = make_session_running(transaction)
    service = EnrichmentVisualisationService(session)

    # When the count query runs
    count = service.query_go_term_count(9606)

    # Then the cypher ran with the organism bound
    assert count == 42
    cypher, params = transaction.run.call_args[0][0], transaction.run.call_args[1]
    assert "MATCH (n:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId})" in cypher
    assert params == {"taxId": 9606}


def test_query_go_term_count_raises_when_no_terms_are_found():
    """An empty result means the organism is unusable, so it should fail fast."""
    # Given a session that finds no GO terms
    session = make_session()
    session.execute_read.return_value = []
    service = EnrichmentVisualisationService(session)

    # When the count query runs
    # Then it raises naming the organism
    with pytest.raises(Exception, match="Could not find related GO terms"):
        service.query_go_term_count(9606)
