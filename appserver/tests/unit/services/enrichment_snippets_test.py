"""Annotated snippets for enrichment table cells.

The client parses each snippet as XML (DOMParser, application/xml) and shows
the parser's error message instead of the cell when a snippet is not
well-formed, so every snippet must parse, whatever the cell says.
"""
import json
from xml.etree import ElementTree

from neo4japp.services.annotations.enrichment_snippets import (
    add_enrichment_snippets,
    highlight_annotations,
)
from neo4japp.services.enrichment.enrichment_table import EnrichmentTableService


def annotation(text, lo, keyword=None, type_='Protein'):
    keyword = keyword or text
    return {
        'meta': {'type': type_, 'id': 'P05023', 'allText': keyword},
        'textInDocument': keyword,
        'keyword': keyword,
        'keywordLength': len(keyword),
        'loLocationOffset': lo,
        'hiLocationOffset': lo + len(keyword) - 1,
        'enrichmentDomain': {},
    }


def parse(snippet):
    element = ElementTree.fromstring(snippet)
    assert element.tag == 'snippet'
    return element


def test_marks_up_an_annotation_inside_the_cell_text():
    snippet = parse(highlight_annotations('Inhibits MAPK1 activity', [annotation('MAPK1', 9)]))

    assert ''.join(snippet.itertext()) == 'Inhibits MAPK1 activity'
    marked = snippet.find('annotation')
    assert marked.text == 'MAPK1'
    assert marked.get('type') == 'Protein'
    assert json.loads(marked.get('meta'))['id'] == 'P05023'


def test_keeps_cell_text_with_markup_characters_well_formed():
    for text in ['Na(+)/K(+) & H(+) exchange', 'Active at pH < 7', '<b>bold</b> claims']:
        assert ''.join(parse(highlight_annotations(text, [])).itertext()) == text


def test_keeps_text_around_an_annotation_well_formed():
    text = 'Na & K-ATPase alpha <1>'
    snippet = parse(highlight_annotations(text, [annotation('K-ATPase', 5)]))

    assert ''.join(snippet.itertext()) == text
    assert snippet.find('annotation').text == 'K-ATPase'


def test_puts_well_formed_snippets_in_every_cell_of_the_table():
    table = {
        'data': {'genes': 'ATP1A1', 'taxId': '9606', 'organism': 'Homo sapiens', 'sources': []},
        'result': {
            'domainInfo': {'UniProt': {'labels': ['Function']}},
            'genes': [{
                'imported': 'ATP1A1',
                'matched': 'ATP1A1',
                'fullName': 'ATPase Na+/K+ transporting subunit alpha 1',
                'domains': {'UniProt': {'Function': {
                    'text': 'Exchanges Na(+) & K(+) ions; works when [Na+] < [K+]',
                    'link': '',
                }}},
            }],
        },
    }
    enriched = EnrichmentTableService.create_annotation_mappings(None, table)
    # 'ATP1A1 ATP1A1 ATPase ...': the Matched cell starts at 7
    annotations = [annotation('ATP1A1', 7, type_='Gene')]

    gene = add_enrichment_snippets(table, enriched, annotations)['result']['genes'][0]

    assert parse(gene['annotatedMatched']).find('annotation').text == 'ATP1A1'
    for snippet, text in [
        (gene['annotatedImported'], 'ATP1A1'),
        (gene['annotatedFullName'], 'ATPase Na+/K+ transporting subunit alpha 1'),
        (gene['domains']['UniProt']['Function']['annotatedText'],
         'Exchanges Na(+) & K(+) ions; works when [Na+] < [K+]'),
    ]:
        assert ''.join(parse(snippet).itertext()) == text
