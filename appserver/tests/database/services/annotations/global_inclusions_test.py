import pytest

from neo4japp.services.annotations.constants import EntityType
from neo4japp.services.annotations.utils.graph_queries import (
    get_delete_global_inclusion_query,
    get_global_inclusions_by_type_query,
    get_global_inclusions_count_query,
    get_global_inclusions_paginated_query,
    get_global_inclusions_query,
    get_node_labels_and_relationship_query,
)


@pytest.mark.parametrize('query, params', [
    pytest.param(get_global_inclusions_count_query(), {}, id='count'),
    pytest.param(get_global_inclusions_query(), {}, id='list'),
    pytest.param(get_global_inclusions_paginated_query(), {'skip': 0, 'limit': 10}, id='page'),
    pytest.param(get_global_inclusions_by_type_query(EntityType.GENE.value), {}, id='by type'),
    pytest.param(get_node_labels_and_relationship_query(), {'node_ids': []}, id='labels'),
    pytest.param(get_delete_global_inclusion_query(), {'node_ids': []}, id='delete'),
])
def test_inclusion_query_runs_on_neo4j_5(graph, query, params):
    # Neo4j 5 rejects such a query outright
    summary = graph.run(f'EXPLAIN {query}', params).consume()
    if summary.server.agent.startswith('Neo4j/4.'):
        # Neo4j 4.4, which CI runs, only warns about what Neo4j 5 removed
        assert [
            status.status_description for status in summary.gql_status_objects
            if 'deprecated' in status.status_description
        ] == []


@pytest.fixture(scope='function')
def synonym_of_two_genes(graph):
    """'alias' is a global inclusion for gene a; gene b has it as a synonym too."""
    return graph.run("""
        CREATE (a:db_NCBI:Gene {eid: 'a', name: 'gene a', original_entity_types: ['Gene']})
        CREATE (b:db_NCBI:Gene {eid: 'b', name: 'gene b', original_entity_types: ['Gene']})
        CREATE (s:Synonym:GlobalInclusion {name: 'alias', lowercase_name: 'alias'})
        CREATE (a)-[:HAS_SYNONYM]->(:Synonym {name: 'gene a'})
        CREATE (a)-[:HAS_SYNONYM {
            global_inclusion: true, inclusion_date: datetime(), entity_type: 'Gene'
        }]->(s)
        CREATE (b)-[:HAS_SYNONYM]->(s)
        RETURN id(a) AS a, id(b) AS b, id(s) AS s
    """).single()


def labels_of(graph, node_id):
    return set(graph.run(
        'MATCH (n) WHERE id(n) = $node_id RETURN labels(n) AS labels', node_id=node_id
    ).single()['labels'])


def test_removing_the_last_global_inclusion_unlabels_the_synonym(
    graph, get_manual_annotation_service, synonym_of_two_genes
):
    ids = synonym_of_two_genes

    get_manual_annotation_service.remove_global_inclusions([(ids['a'], ids['s'])])

    assert labels_of(graph, ids['s']) == {'Synonym'}
    assert labels_of(graph, ids['a']) == {'db_NCBI', 'Gene'}
    assert graph.run(
        'MATCH (n)-[:HAS_SYNONYM]->(s) WHERE id(s) = $s RETURN collect(n.eid) AS genes',
        s=ids['s']
    ).single()['genes'] == ['b']


def test_removing_one_of_two_global_inclusions_keeps_the_label(
    graph, get_manual_annotation_service, synonym_of_two_genes
):
    ids = synonym_of_two_genes
    graph.run("""
        MATCH (b)-[r:HAS_SYNONYM]->(s) WHERE id(b) = $b AND id(s) = $s
        SET r.global_inclusion = true, r.inclusion_date = datetime(), r.entity_type = 'Gene'
    """, b=ids['b'], s=ids['s']).consume()

    get_manual_annotation_service.remove_global_inclusions([(ids['a'], ids['s'])])

    assert 'GlobalInclusion' in labels_of(graph, ids['s'])


def test_removing_every_global_inclusion_at_once_unlabels_the_synonym(
    graph, get_manual_annotation_service, synonym_of_two_genes
):
    ids = synonym_of_two_genes
    graph.run("""
        MATCH (b)-[r:HAS_SYNONYM]->(s) WHERE id(b) = $b AND id(s) = $s
        SET r.global_inclusion = true, r.inclusion_date = datetime(), r.entity_type = 'Gene'
    """, b=ids['b'], s=ids['s']).consume()

    get_manual_annotation_service.remove_global_inclusions(
        [(ids['a'], ids['s']), (ids['b'], ids['s'])])

    assert labels_of(graph, ids['s']) == {'Synonym'}

