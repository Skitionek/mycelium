from string import punctuation
from typing import List, Tuple

import requests
from neo4japp.constants import FILE_MIME_TYPE_PDF
from neo4japp.exceptions import ServerException

from ..constants import (
    MAX_ABBREVIATION_WORD_LENGTH,
    PDFPARSER_URL,
    REQUEST_TIMEOUT
)
from ..data_transfer_objects import PDFWord


def process_parsed_content(resp: dict) -> Tuple[str, List[PDFWord]]:
    parsed = []
    pdf_text = ''

    for page in resp['pages']:
        prev_words: List[str] = []
        pdf_text += page['pageText']
        for token in page['tokens']:
            # for now ignore any rotated words
            if token['text'] not in punctuation and all([rect['rotation'] == 0 for rect in token['rects']]):  # noqa
                pdf_word = PDFWord(
                    keyword=token['text'],
                    normalized_keyword=token['text'],  # don't need to normalize yet
                    page_number=page['pageNo'],
                    lo_location_offset=token['pgIdx'],
                    hi_location_offset=token['pgIdx'] if len(
                        token['text']) == 1 else token['pgIdx'] + len(token['text']) - 1,  # noqa
                    heights=[rect['height'] for rect in token['rects']],
                    widths=[rect['width'] for rect in token['rects']],
                    coordinates=[
                        [
                            rect['lowerLeftPt']['x'],
                            rect['lowerLeftPt']['y'],
                            rect['lowerLeftPt']['x'] + rect['width'],
                            rect['lowerLeftPt']['y'] + rect['height']
                        ] for rect in token['rects']
                    ],
                    previous_words=' '.join(
                        prev_words[-MAX_ABBREVIATION_WORD_LENGTH:]) if token['possibleAbbrev'] else '',  # noqa
                )
                parsed.append(pdf_word)
                prev_words.append(token['text'])
                if len(prev_words) > MAX_ABBREVIATION_WORD_LENGTH:
                    prev_words = prev_words[1:]
    return pdf_text, parsed


def parse_content(content_type=FILE_MIME_TYPE_PDF, **kwargs) -> Tuple[str, List[PDFWord]]:
    if content_type == FILE_MIME_TYPE_PDF:
        pdf_bytes = kwargs.get('pdf_bytes')
        if not pdf_bytes:
            raise ServerException(
                'Parsing Error',
                'Cannot parse the PDF file: no content provided.')
        url = f'{PDFPARSER_URL}/token/rect/json/'
        try:
            req = requests.post(
                url,
                files={'file': ('document.pdf', pdf_bytes, 'application/pdf')},
                timeout=REQUEST_TIMEOUT,
            )
            resp = req.json()
            req.close()
        except requests.exceptions.ConnectTimeout:
            raise ServerException(
                'Parsing Error',
                'The request timed out while trying to connect to the parsing service.')
        except requests.exceptions.Timeout:
            raise ServerException(
                'Parsing Error',
                'The request to the parsing service timed out.')
        except (requests.exceptions.RequestException, Exception):
            raise ServerException(
                'Parsing Error',
                'An unexpected error occurred with the parsing service.')
    else:
        text = kwargs.get('text', '')
        url = f'{PDFPARSER_URL}/token/rect/text/json'
        try:
            req = requests.post(url, data={'text': text}, timeout=REQUEST_TIMEOUT)
            resp = req.json()
            req.close()
        except requests.exceptions.ConnectTimeout:
            raise ServerException(
                'Parsing Error',
                'The request timed out while trying to connect to the parsing service.')
        except requests.exceptions.Timeout:
            raise ServerException(
                'Parsing Error',
                'The request to the parsing service timed out.')
        except (requests.exceptions.RequestException, Exception):
            raise ServerException(
                'Parsing Error',
                'An unexpected error occurred with the parsing service.')

    return process_parsed_content(resp)
