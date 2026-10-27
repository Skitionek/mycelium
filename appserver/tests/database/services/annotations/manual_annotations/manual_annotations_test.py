import pytest

from os import path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from neo4japp.constants import FILE_MIME_TYPE_PDF
from neo4japp.exceptions import AnnotationError
from neo4japp.services.annotations.constants import EntityType
from neo4japp.services.annotations import ManualAnnotationService, Tokenizer


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def test_add_custom_annotation_inclusion_annotate_all(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.SPECIES.value,
            'allText': 'Pikachu',
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    inclusions = annotation_service.add_inclusions(
        file=file_in_project,
        user=project_owner,
        custom_annotation=custom,
        annotate_all=True
    )
    assert len(inclusions) == 2


def test_add_custom_annotation_inclusion_multi_word(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.SPECIES.value,
            'allText': 'caught a Pikachu',
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    inclusions = annotation_service.add_inclusions(
        file=file_in_project,
        user=project_owner,
        custom_annotation=custom,
        annotate_all=True
    )

    assert len(inclusions) == 2


def test_add_custom_annotation_inclusion(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.SPECIES.value,
            'allText': 'Pikachu',
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    inclusions = annotation_service.add_inclusions(
        file=file_in_project,
        user=project_owner,
        custom_annotation=custom,
        annotate_all=False
    )
    assert len(inclusions) == 1


def test_add_custom_annotation_inclusion_multi_word_gene_limit(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.GENE.value,
            'allText': 'caught a Pikachu',  # GENE max limit is 1 word
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    with pytest.raises(AnnotationError):
        annotation_service.add_inclusions(
            file=file_in_project,
            user=project_owner,
            custom_annotation=custom,
            annotate_all=True
        )


def test_add_custom_annotation_inclusion_multi_word_food_limit(
    get_manual_annotation_service,
    mock_add_custom_annotation_inclusion,
    file_in_project,
    project_owner
):
    annotation_service = get_manual_annotation_service

    custom = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.GENE.value,
            'allText': 'I just caught a Pikachu',  # FOOD max limit is 4 word
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': True,
            'includeGlobally': False
        }
    }

    with pytest.raises(AnnotationError):
        annotation_service.add_inclusions(
            file=file_in_project,
            user=project_owner,
            custom_annotation=custom,
            annotate_all=True
        )


def test_annotate_all_passes_pdf_bytes_to_parse_content():
    """parse_content must receive pdf_bytes after the #773 parser switch."""
    raw = b'%PDF-1.4 fake pdf content'
    file_content = SimpleNamespace(raw_file=raw)
    file = SimpleNamespace(
        id=1,
        mime_type=FILE_MIME_TYPE_PDF,
        content=file_content,
        custom_annotations=[],
        excluded_annotations=[],
        hash_id='testhashid',
        content_id=42,
    )
    user = SimpleNamespace(id=1, username='testuser')
    custom = {
        'meta': {
            'id': '',
            'type': EntityType.SPECIES.value,
            'allText': 'Pikachu',
            'idType': '',
            'idHyperlinks': [],
            'isCaseInsensitive': False,
            'includeGlobally': False,
        }
    }

    mock_graph = MagicMock()
    mock_graph.get_nodes_from_node_ids.return_value = {}

    mock_token = MagicMock()
    mock_token.keyword = 'Pikachu'
    mock_token.normalized_keyword = 'pikachu'
    mock_token.page_number = 1
    mock_token.lo_location_offset = 0
    mock_token.hi_location_offset = 6
    mock_token.heights = [10.0]
    mock_token.widths = [50.0]
    mock_token.coordinates = [[0, 0, 50, 10]]
    mock_token.previous_words = ''

    service = ManualAnnotationService(graph=mock_graph, tokenizer=Tokenizer())

    match_result = [{'page_number': 1, 'rects': [[0, 0, 50, 10]], 'keywords': ['Pikachu']}]

    with patch(
        'neo4japp.services.annotations.manual_annotation_service.parse_content'
    ) as mock_parse, patch.object(
        service, '_get_matching_manual_annotations', return_value=match_result
    ), patch('neo4japp.services.annotations.manual_annotation_service.db'):
        mock_parse.return_value = ('text', [mock_token])

        service.add_inclusions(
            file=file,
            user=user,
            custom_annotation=custom,
            annotate_all=True,
        )

        mock_parse.assert_called_once_with(FILE_MIME_TYPE_PDF, pdf_bytes=raw)
