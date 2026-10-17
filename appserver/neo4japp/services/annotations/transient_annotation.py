"""
Annotating PDFs that are not stored on the server, such as files in a user's local folder.

The same pipeline as for uploaded documents runs, but nothing is written to the database:
the annotations are returned to the caller, which keeps them (the local indexer saves them
into the folder itself).
"""
from typing import List, Optional

from neo4japp.constants import APPSERVER_URL, FILE_MIME_TYPE_PDF
from neo4japp.services.transient_files import discard_transient_file, stash_transient_file

from .constants import DEFAULT_ANNOTATION_CONFIGS
from .initializer import (
    get_annotation_db_service,
    get_annotation_graph_service,
    get_annotation_service,
    get_annotation_tokenizer,
    get_bioc_document_service,
    get_recognition_service,
)
from .pipeline import Pipeline
from .utils.parsing import parse_content


def transient_file_url(token: str) -> str:
    return f'{APPSERVER_URL}/annotations/transient/{token}'


def annotate_transient_pdf(
    content: bytes,
    filename: str,
    configs: Optional[dict] = None,
    organism_synonym: str = '',
    organism_taxonomy_id: str = '',
) -> List[dict]:
    """
    Identify entities in a PDF given as bytes.

    :param content: the PDF
    :param filename: the file's name, which the pipeline uses for logging
    :param configs: annotation configuration, see DEFAULT_ANNOTATION_CONFIGS
    :return: the annotations, in the shape GET /filesystem/objects/<id>/annotations returns them
    """
    configs = configs or DEFAULT_ANNOTATION_CONFIGS
    token = stash_transient_file(content)
    try:
        text, parsed = parse_content(
            FILE_MIME_TYPE_PDF,
            file_url=transient_file_url(token),
            exclude_references=configs['exclude_references'],
        )
    finally:
        # The parser has fetched the file by now
        discard_transient_file(token)

    pipeline = Pipeline(
        {
            'adbs': get_annotation_db_service,
            'ags': get_annotation_graph_service,
            'aers': get_recognition_service,
            'tkner': get_annotation_tokenizer,
            'as': get_annotation_service,
            'bs': get_bioc_document_service,
        },
        text=text, parsed=parsed)

    annotations_json = pipeline.get_globals(
        excluded_annotations=[],
        custom_annotations=[],
    ).identify(
        annotation_methods=configs['annotation_methods']
    ).annotate(
        specified_organism_synonym=organism_synonym,
        specified_organism_tax_id=organism_taxonomy_id,
        custom_annotations=[],
        filename=filename)

    return annotations_json['documents'][0]['passages'][0]['annotations']
