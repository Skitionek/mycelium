"""
Turning the annotations of an enrichment table's combined text back into per-cell snippets,
which is what the enrichment table viewer highlights.
"""
import html
import json
from typing import List

from neo4japp.services.enrichment.data_transfer_objects import EnrichmentCellTextMapping


def highlight_annotations(original_text: str, annotations: List[dict]) -> str:
    # If done right, we would parse the XML but the built-in XML libraries in Python
    # are susceptible to some security vulns, but because this is an internal API,
    # we can accept that it can be janky. The client parses the result as XML, so
    # the cell text must be escaped

    texts = []
    prev_ending_index = -1

    for annotation in annotations:
        meta = annotation['meta']
        meta_type = annotation['meta']['type']
        term = annotation['textInDocument']
        lo_location_offset = annotation['loLocationOffset']
        hi_location_offset = annotation['hiLocationOffset']

        text = f'<annotation type="{meta_type}" meta="{html.escape(json.dumps(meta))}">{html.escape(term, quote=False)}</annotation>'  # noqa

        if lo_location_offset == 0:
            prev_ending_index = hi_location_offset
            texts.append(text)
        else:
            if not texts:
                texts.append(html.escape(original_text[:lo_location_offset], quote=False))
                prev_ending_index = hi_location_offset
                texts.append(text)
            else:
                # TODO: would lo_location_offset == prev_ending_index ever happen?
                # if yes, need to handle it
                texts.append(html.escape(
                    original_text[prev_ending_index + 1:lo_location_offset], quote=False))
                prev_ending_index = hi_location_offset
                texts.append(text)

    texts.append(html.escape(original_text[prev_ending_index + 1:], quote=False))
    final_text = ''.join(texts)
    return f'<snippet>{final_text}</snippet>'


def add_enrichment_snippets(
    enrichment: dict,
    enriched: EnrichmentCellTextMapping,
    annotations: List[dict],
) -> dict:
    """
    Store an annotated snippet in every cell of the enrichment table.

    :param enrichment: the enrichment table, changed in place
    :param enriched: the table's cell texts, as annotated
    :param annotations: the annotations of the combined cell texts
    :return: the enrichment table
    """
    # NOTE: code below to calculate the correct offsets for enrichment table
    # and correctly highlight based on cell is not pretty
    # sort by lo_location_offset to go from beginning to end
    sorted_annotations_list = sorted(annotations, key=lambda x: x['loLocationOffset'])

    prev_index = -1
    enriched_gene = ''

    for index, cell_text in enriched.text_index_map:
        annotation_chunk = [anno for anno in sorted_annotations_list if anno.get(
            'hiLocationOffset', None) and anno.get('hiLocationOffset') <= index]
        # it's sorted so we can do this to make the list shorter every iteration
        sorted_annotations_list = sorted_annotations_list[len(annotation_chunk):]

        # update JSON to have enrichment row and domain...
        for anno in annotation_chunk:
            if prev_index != -1:
                # only do this for subsequent cells b/c
                # first cell will always have the correct index
                # update index offset to be relative to the cell again
                # since they're relative to the combined text
                anno['loLocationOffset'] = anno['loLocationOffset'] - (prev_index + 1) - 1  # noqa
                anno['hiLocationOffset'] = anno['loLocationOffset'] + anno['keywordLength'] - 1  # noqa

            if 'domain' in cell_text:
                # imported should come first for each row
                if cell_text['domain'] == 'Imported':
                    enriched_gene = cell_text['text']
                anno['enrichmentGene'] = enriched_gene
                if cell_text['domain'] == 'Regulon':
                    anno['enrichmentDomain']['domain'] = cell_text['domain']
                    anno['enrichmentDomain']['subDomain'] = cell_text['label']
                else:
                    anno['enrichmentDomain']['domain'] = cell_text['domain']

        snippet = highlight_annotations(
            original_text=cell_text['text'],
            annotations=annotation_chunk
        )
        if cell_text['domain'] == 'Imported':
            enrichment['result']['genes'][cell_text[
                'index']]['annotatedImported'] = snippet
        elif cell_text['domain'] == 'Matched':
            enrichment['result']['genes'][cell_text[
                'index']]['annotatedMatched'] = snippet
        elif cell_text['domain'] == 'Full Name':
            enrichment['result']['genes'][cell_text[
                'index']]['annotatedFullName'] = snippet
        else:
            enrichment['result'][
                'genes'][cell_text[
                    'index']]['domains'][cell_text[
                        'domain']][cell_text[
                            'label']]['annotatedText'] = snippet

        prev_index = index

    return enrichment
