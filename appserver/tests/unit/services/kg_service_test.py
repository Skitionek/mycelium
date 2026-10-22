"""Unit tests for neo4japp.services.kg_service helpers (no DB required)."""
from neo4japp.services.kg_service import build_go_annotations_link


# build_go_annotations_link
def test_links_to_quickgo_filtered_by_accession_when_one_is_known():
    # Given
    uniprot_id = 'P0A7B8'
    gene_name = 'nusG'

    # When
    link = build_go_annotations_link(uniprot_id, gene_name)

    # Then
    assert link == (
        'https://www.ebi.ac.uk/QuickGO/annotations'
        '?geneProductId=UniProtKB:P0A7B8'
    )


def test_falls_back_to_amigo_search_when_no_accession_is_known():
    # Given
    uniprot_id = None
    gene_name = 'nusG'

    # When
    link = build_go_annotations_link(uniprot_id, gene_name)

    # Then
    assert link == (
        'http://amigo.geneontology.org/amigo/search/annotation?q=nusG'
    )


def test_escapes_gene_names_that_are_not_url_safe():
    # Given
    uniprot_id = None
    gene_name = 'ins-1/ins-2'

    # When
    link = build_go_annotations_link(uniprot_id, gene_name)

    # Then
    assert link == (
        'http://amigo.geneontology.org/amigo/search/annotation'
        '?q=ins-1%2Fins-2'
    )


def test_never_emits_an_empty_query_value():
    # Given a gene with neither an accession nor a name
    uniprot_id = None
    gene_name = None

    # When
    link = build_go_annotations_link(uniprot_id, gene_name)

    # Then the link is still a search, not a bare QuickGO listing
    assert 'geneProductId=' not in link
    assert link.endswith('?q=')
