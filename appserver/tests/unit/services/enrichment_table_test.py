"""Turning an enrichment table into one text to annotate, and back into its cells."""
import pytest

from neo4japp.exceptions import AnnotationError
from neo4japp.services.enrichment.enrichment_table import EnrichmentTableService

DATA = {'genes': 'TP53,NOTAGENE', 'taxId': '9606', 'organism': 'Homo sapiens', 'sources': []}


def mappings(table):
    # The mapping only reshapes the table, so it needs no graph or database
    return EnrichmentTableService.create_annotation_mappings(None, table)


def test_joins_the_cells_of_matched_genes():
    enriched = mappings({
        'data': DATA,
        'result': {
            'domainInfo': {},
            'genes': [
                {'imported': 'TP53', 'matched': 'TP53', 'fullName': 'tumor protein p53'},
                {'imported': 'NOTAGENE'},
            ],
        },
    })

    assert enriched.text == 'TP53 TP53 tumor protein p53 '
    assert [(end, cell['domain']) for end, cell in enriched.text_index_map] == [
        (3, 'Imported'), (8, 'Matched'), (26, 'Full Name'),
    ]


def test_leaves_go_and_biocyc_cells_out_of_the_text():
    enriched = mappings({
        'data': DATA,
        'result': {
            'domainInfo': {'GO': {'labels': ['Annotation']}, 'UniProt': {'labels': ['Function']}},
            'genes': [{
                'imported': 'TP53',
                'matched': 'TP53',
                'fullName': 'tumor protein p53',
                'domains': {
                    'GO': {'Annotation': {'text': 'apoptotic process', 'link': ''}},
                    'UniProt': {'Function': {'text': 'Acts as a tumor suppressor', 'link': ''}},
                },
            }],
        },
    })

    assert enriched.text == 'TP53 TP53 tumor protein p53 Acts as a tumor suppressor '
    assert {cell['domain'] for cell in enriched.cell_texts} >= {'GO', 'UniProt'}


def test_rejects_an_invalid_table():
    with pytest.raises(AnnotationError):
        mappings({'result': {'genes': []}})


def test_rejects_a_table_without_results():
    """The schema lets a table hold only its parameters, but there is nothing to annotate.

    Bulk re-annotation reports an AnnotationError for the one file and goes on
    with the others; anything else fails the whole request.
    """
    with pytest.raises(AnnotationError):
        mappings({'data': DATA})
