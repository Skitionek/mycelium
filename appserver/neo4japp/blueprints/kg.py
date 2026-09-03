from enum import Enum

from flask import Blueprint, request, jsonify

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_kg_service, get_neo4j_db

bp = Blueprint('kg-api', __name__, url_prefix='/knowledge-graph')

# ── Pre-defined shortest-path queries ──────────────────────────
# These are canned graph queries that demonstrate the pathway browser.
# Each query returns a subgraph (nodes + edges) from Neo4j.
SHORTEST_PATH_QUERIES = {
    0: 'Glycolysis → TCA Cycle',
    1: 'DNA Replication → Cell Division',
    2: 'Signal Transduction → Gene Expression',
    3: 'Amino Acid Biosynthesis → Protein Folding',
}

# Node color palette by database label
_COLORS = {
    'Gene':      {'border': '#2B7CE9', 'background': '#97C2FC'},
    'Protein':   {'border': '#FFA500', 'background': '#FFCF70'},
    'Metabolite': {'border': '#41A906', 'background': '#7BE141'},
    'Pathway':   {'border': '#E129F0', 'background': '#EB7DF4'},
    'Reaction':  {'border': '#FA0A10', 'background': '#FB7E81'},
    'Enzyme':    {'border': '#6E6EFD', 'background': '#AAAAFF'},
    'default':   {'border': '#2B7CE9', 'background': '#97C2FC'},
}


def _query_graph_from_neo4j(query_id):
    """Run a shortest-path query against Neo4j.

    If Neo4j has data, uses shortest-path queries.
    Otherwise, returns a demo subgraph so the prototype is functional.
    """
    graph = get_neo4j_db()

    # Try to get real data from Neo4j
    try:
        node_count = graph.execute_read(
            lambda tx: tx.run('MATCH (n) RETURN count(n) AS cnt').single()['cnt']
        )
    except Exception:
        node_count = 0

    if node_count > 0:
        # Real data exists — run an actual shortest-path query
        try:
            def _run_path_query(tx):
                result = tx.run(
                    '''
                    MATCH path = shortestPath((a)-[*..10]-(b))
                    WHERE id(a) <> id(b)
                    RETURN path
                    LIMIT 1
                    '''
                )
                return [dict(record) for record in result]

            path_result = graph.execute_read(_run_path_query)
            if path_result:
                nodes = []
                edges = []
                seen_nodes = set()
                seen_edges = set()
                for record in path_result:
                    p = record['path']
                    for node in p.nodes:
                        nid = node.element_id if hasattr(node, 'element_id') else node.id
                        if nid not in seen_nodes:
                            seen_nodes.add(nid)
                            lbl = list(node.labels)[0] if node.labels else 'default'
                            colors = _COLORS.get(lbl, _COLORS['default'])
                            nodes.append({
                                'id': nid,
                                'label': node.get('name', node.get('label', f'Node {nid}')),
                                'color': colors,
                                'databaseLabel': lbl,
                            })
                    for rel in p.relationships:
                        s = rel.start_node.element_id if hasattr(rel.start_node, 'element_id') else rel.start_node.id
                        e = rel.end_node.element_id if hasattr(rel.end_node, 'element_id') else rel.end_node.id
                        edge_key = (s, e, rel.type)
                        if edge_key not in seen_edges:
                            seen_edges.add(edge_key)
                            edges.append({
                                'from': s,
                                'to': e,
                                'label': rel.type,
                            })
                return {'nodes': nodes, 'edges': edges}
        except Exception:
            pass

    # No data in Neo4j — return a demo graph
    return _demo_graph(query_id)


def _demo_graph(query_id):
    """Return a self-contained demo graph for the pathway browser prototype."""
    import random
    random.seed(query_id)

    demos = [
        # 0: Glycolysis → TCA Cycle
        {
            'nodes': [
                {'id': 1, 'label': 'Glucose', 'databaseLabel': 'Metabolite'},
                {'id': 2, 'label': 'Hexokinase', 'databaseLabel': 'Enzyme'},
                {'id': 3, 'label': 'Glucose-6-P', 'databaseLabel': 'Metabolite'},
                {'id': 4, 'label': 'PFK-1', 'databaseLabel': 'Enzyme'},
                {'id': 5, 'label': 'Fructose-1,6-BP', 'databaseLabel': 'Metabolite'},
                {'id': 6, 'label': 'Pyruvate Kinase', 'databaseLabel': 'Enzyme'},
                {'id': 7, 'label': 'Pyruvate', 'databaseLabel': 'Metabolite'},
                {'id': 8, 'label': 'PDH Complex', 'databaseLabel': 'Enzyme'},
                {'id': 9, 'label': 'Acetyl-CoA', 'databaseLabel': 'Metabolite'},
                {'id': 10, 'label': 'Citrate Synthase', 'databaseLabel': 'Enzyme'},
                {'id': 11, 'label': 'Citrate', 'databaseLabel': 'Metabolite'},
                {'id': 12, 'label': 'α-Ketoglutarate', 'databaseLabel': 'Metabolite'},
                {'id': 13, 'label': 'Succinate', 'databaseLabel': 'Metabolite'},
                {'id': 14, 'label': 'Oxaloacetate', 'databaseLabel': 'Metabolite'},
                {'id': 15, 'label': 'Glycolysis', 'databaseLabel': 'Pathway'},
                {'id': 16, 'label': 'TCA Cycle', 'databaseLabel': 'Pathway'},
            ],
            'edges': [
                {'from': 1, 'to': 2, 'label': 'substrate_of'},
                {'from': 2, 'to': 3, 'label': 'produces'},
                {'from': 3, 'to': 4, 'label': 'substrate_of'},
                {'from': 4, 'to': 5, 'label': 'produces'},
                {'from': 5, 'to': 6, 'label': 'substrate_of'},
                {'from': 6, 'to': 7, 'label': 'produces'},
                {'from': 7, 'to': 8, 'label': 'substrate_of'},
                {'from': 8, 'to': 9, 'label': 'produces'},
                {'from': 9, 'to': 10, 'label': 'substrate_of'},
                {'from': 10, 'to': 11, 'label': 'produces'},
                {'from': 11, 'to': 12, 'label': 'converts_to'},
                {'from': 12, 'to': 13, 'label': 'converts_to'},
                {'from': 13, 'to': 14, 'label': 'converts_to'},
                {'from': 14, 'to': 10, 'label': 'substrate_of'},
                {'from': 1, 'to': 15, 'label': 'part_of'},
                {'from': 7, 'to': 15, 'label': 'part_of'},
                {'from': 9, 'to': 16, 'label': 'part_of'},
                {'from': 11, 'to': 16, 'label': 'part_of'},
            ],
        },
        # 1: DNA Replication → Cell Division
        {
            'nodes': [
                {'id': 1, 'label': 'ORI', 'databaseLabel': 'Gene'},
                {'id': 2, 'label': 'Helicase', 'databaseLabel': 'Protein'},
                {'id': 3, 'label': 'Primase', 'databaseLabel': 'Enzyme'},
                {'id': 4, 'label': 'DNA Pol III', 'databaseLabel': 'Enzyme'},
                {'id': 5, 'label': 'Leading Strand', 'databaseLabel': 'Gene'},
                {'id': 6, 'label': 'Lagging Strand', 'databaseLabel': 'Gene'},
                {'id': 7, 'label': 'Ligase', 'databaseLabel': 'Enzyme'},
                {'id': 8, 'label': 'Replicated DNA', 'databaseLabel': 'Gene'},
                {'id': 9, 'label': 'FtsZ', 'databaseLabel': 'Protein'},
                {'id': 10, 'label': 'Z-Ring', 'databaseLabel': 'Protein'},
                {'id': 11, 'label': 'Cell Division', 'databaseLabel': 'Pathway'},
                {'id': 12, 'label': 'DNA Replication', 'databaseLabel': 'Pathway'},
            ],
            'edges': [
                {'from': 1, 'to': 2, 'label': 'unwinds'},
                {'from': 2, 'to': 3, 'label': 'recruits'},
                {'from': 3, 'to': 4, 'label': 'primes'},
                {'from': 4, 'to': 5, 'label': 'synthesizes'},
                {'from': 4, 'to': 6, 'label': 'synthesizes'},
                {'from': 6, 'to': 7, 'label': 'joined_by'},
                {'from': 5, 'to': 8, 'label': 'produces'},
                {'from': 7, 'to': 8, 'label': 'produces'},
                {'from': 8, 'to': 9, 'label': 'triggers'},
                {'from': 9, 'to': 10, 'label': 'forms'},
                {'from': 10, 'to': 11, 'label': 'part_of'},
                {'from': 1, 'to': 12, 'label': 'part_of'},
            ],
        },
        # 2: Signal Transduction → Gene Expression
        {
            'nodes': [
                {'id': 1, 'label': 'Ligand', 'databaseLabel': 'Metabolite'},
                {'id': 2, 'label': 'Receptor', 'databaseLabel': 'Protein'},
                {'id': 3, 'label': 'G-Protein', 'databaseLabel': 'Protein'},
                {'id': 4, 'label': 'Adenylyl Cyclase', 'databaseLabel': 'Enzyme'},
                {'id': 5, 'label': 'cAMP', 'databaseLabel': 'Metabolite'},
                {'id': 6, 'label': 'PKA', 'databaseLabel': 'Enzyme'},
                {'id': 7, 'label': 'CREB', 'databaseLabel': 'Protein'},
                {'id': 8, 'label': 'Target Gene', 'databaseLabel': 'Gene'},
                {'id': 9, 'label': 'mRNA', 'databaseLabel': 'Gene'},
                {'id': 10, 'label': 'Protein Product', 'databaseLabel': 'Protein'},
                {'id': 11, 'label': 'Signal Transduction', 'databaseLabel': 'Pathway'},
                {'id': 12, 'label': 'Gene Expression', 'databaseLabel': 'Pathway'},
            ],
            'edges': [
                {'from': 1, 'to': 2, 'label': 'binds'},
                {'from': 2, 'to': 3, 'label': 'activates'},
                {'from': 3, 'to': 4, 'label': 'activates'},
                {'from': 4, 'to': 5, 'label': 'produces'},
                {'from': 5, 'to': 6, 'label': 'activates'},
                {'from': 6, 'to': 7, 'label': 'phosphorylates'},
                {'from': 7, 'to': 8, 'label': 'binds_promoter'},
                {'from': 8, 'to': 9, 'label': 'transcribes'},
                {'from': 9, 'to': 10, 'label': 'translates'},
                {'from': 1, 'to': 11, 'label': 'part_of'},
                {'from': 8, 'to': 12, 'label': 'part_of'},
            ],
        },
        # 3: Amino Acid Biosynthesis → Protein Folding
        {
            'nodes': [
                {'id': 1, 'label': 'Pyruvate', 'databaseLabel': 'Metabolite'},
                {'id': 2, 'label': 'Transaminase', 'databaseLabel': 'Enzyme'},
                {'id': 3, 'label': 'Alanine', 'databaseLabel': 'Metabolite'},
                {'id': 4, 'label': 'tRNA Synthetase', 'databaseLabel': 'Enzyme'},
                {'id': 5, 'label': 'Ala-tRNA', 'databaseLabel': 'Metabolite'},
                {'id': 6, 'label': 'Ribosome', 'databaseLabel': 'Protein'},
                {'id': 7, 'label': 'Polypeptide', 'databaseLabel': 'Protein'},
                {'id': 8, 'label': 'GroEL/GroES', 'databaseLabel': 'Protein'},
                {'id': 9, 'label': 'Folded Protein', 'databaseLabel': 'Protein'},
                {'id': 10, 'label': 'AA Biosynthesis', 'databaseLabel': 'Pathway'},
                {'id': 11, 'label': 'Protein Folding', 'databaseLabel': 'Pathway'},
            ],
            'edges': [
                {'from': 1, 'to': 2, 'label': 'substrate_of'},
                {'from': 2, 'to': 3, 'label': 'produces'},
                {'from': 3, 'to': 4, 'label': 'substrate_of'},
                {'from': 4, 'to': 5, 'label': 'charges'},
                {'from': 5, 'to': 6, 'label': 'delivered_to'},
                {'from': 6, 'to': 7, 'label': 'synthesizes'},
                {'from': 7, 'to': 8, 'label': 'assisted_by'},
                {'from': 8, 'to': 9, 'label': 'folds'},
                {'from': 1, 'to': 10, 'label': 'part_of'},
                {'from': 9, 'to': 11, 'label': 'part_of'},
            ],
        },
    ]

    idx = query_id % len(demos)
    graph_data = demos[idx]

    # Apply colors
    for node in graph_data['nodes']:
        db_label = node.get('databaseLabel', 'default')
        node['color'] = _COLORS.get(db_label, _COLORS['default'])

    return graph_data


@bp.route('/shortest-path-query-list', methods=['GET'])
@auth.login_required
def get_shortest_path_query_list():
    return jsonify({'result': SHORTEST_PATH_QUERIES}), 200


@bp.route('/shortest-path-query/<int:query_id>', methods=['GET'])
@auth.login_required
def get_shortest_path_query(query_id):
    if query_id not in SHORTEST_PATH_QUERIES:
        return jsonify({'error': f'Query {query_id} not found'}), 404
    result = _query_graph_from_neo4j(query_id)
    return jsonify({'result': result}), 200


# TODO: move this to a constant.py (not the neo4japp/constants.py)
class Domain(Enum):
    REGULON = 'Regulon'
    UNIPROT = 'UniProt'
    STRING = 'String'
    GO = 'GO'
    BIOCYC = 'BioCyc'
    KEGG = 'KEGG'


@bp.route('/get-ncbi-nodes/enrichment-domains', methods=['POST'])
@auth.login_required
def get_ncbi_enrichment_domains():
    """ Find all domains matched to given node id, then return dictionary with all domains as
        result. All domains should have matching indices e.g. regulon[1] should be data from
        matching same node as uniprot[1].
    """
    # TODO: Validate incoming data using webargs + Marshmallow
    data = request.get_json()
    node_ids = data.get('nodeIds')
    tax_id = data.get('taxID')
    domains = data.get('domains')

    nodes = {}

    if node_ids is not None and tax_id is not None:
        kg = get_kg_service()

        regulon = kg.get_regulon_genes(node_ids) if Domain.REGULON.value in domains else {}
        biocyc = kg.get_biocyc_genes(node_ids, tax_id) if Domain.BIOCYC.value in domains else {}
        go = kg.get_go_genes(node_ids) if Domain.GO.value in domains else {}
        string = kg.get_string_genes(node_ids) if Domain.STRING.value in domains else {}
        uniprot = kg.get_uniprot_genes(node_ids) if Domain.UNIPROT.value in domains else {}
        kegg = kg.get_kegg_genes(node_ids) if Domain.KEGG.value in domains else {}

        nodes = {
            node_id: {
                'regulon': regulon.get(node_id, None),
                'uniprot': uniprot.get(node_id, None),
                'string': string.get(node_id, None),
                'go': go.get(node_id, None),
                'biocyc': biocyc.get(node_id, None),
                'kegg': kegg.get(node_id, None),
                'node_id': node_id
            } for node_id in node_ids}

    return jsonify({'result': nodes}), 200
