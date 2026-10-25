"""
Endpoints the client uses for files in folders connected from the user's computer: those
files are never stored, so they are annotated and converted to PDF on request, statelessly.
"""
import io
import json
import shutil
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from flask import Flask, g

from neo4japp.blueprints import annotations as annotations_blueprint
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.filesystem import bp as filesystem_bp
from neo4japp.factory import register_error_handlers
from neo4japp.services import transient_files
from neo4japp.services.annotations import transient_annotation
from neo4japp.services.enrichment.enrichment_table import EnrichmentTableService
from neo4japp.services.libreoffice import (
    ConversionFailedError,
    convert_to_pdf,
    mime_type_for_filename,
)

PDF = b'%PDF-1.7\n% a tiny pdf\n'
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
AUTH = {'Authorization': 'Bearer test-token'}


class FakeRedis:
    def __init__(self):
        self.store = {}
        self.expiries = {}

    def set(self, key, value, ex=None):
        self.store[key] = value
        self.expiries[key] = ex

    def get(self, key):
        return self.store.get(key)

    def delete(self, key):
        self.store.pop(key, None)


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test'
    register_error_handlers(app)
    app.register_blueprint(filesystem_bp)
    app.register_blueprint(annotations_blueprint.bp)
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def logged_in():
    def verify(token):
        if token != 'test-token':
            return False
        g.current_user = SimpleNamespace(username='tester')
        return True

    with patch.object(auth, 'verify_token_callback', verify):
        yield


@pytest.fixture
def redis():
    fake = FakeRedis()
    with patch.object(transient_files, 'redis_server', fake):
        yield fake


def upload(content, name, **fields):
    return {'file': (io.BytesIO(content), name), **fields}


# ---------------------------------------------------------------------------
# Annotating without storing
# ---------------------------------------------------------------------------

def test_transient_annotation_returns_annotations(client, logged_in):
    found = [{
        'meta': {'type': 'Gene', 'id': '672', 'allText': 'BRCA1'},
        'keyword': 'BRCA1',
        'textInDocument': 'BRCA1',
        'pageNumber': 1,
        'rects': [[1, 2, 3, 4]],
        'keywords': ['BRCA1'],
        'uuid': 'a',
    }]
    with patch.object(annotations_blueprint, 'annotate_transient_pdf',
                      return_value=found) as annotate:
        response = client.post(
            '/filesystem/annotations/transient',
            data=upload(PDF, 'paper.pdf', filename='Paper (final).pdf'),
            headers=AUTH,
        )

    assert response.status_code == 200
    assert response.json['total'] == 1
    assert response.json['results'][0]['meta']['allText'] == 'BRCA1'
    annotate.assert_called_once_with(PDF, 'Paper (final).pdf')


def test_transient_annotation_needs_login(client):
    with patch.object(annotations_blueprint, 'annotate_transient_pdf') as annotate:
        response = client.post('/filesystem/annotations/transient', data=upload(PDF, 'paper.pdf'))

    assert response.status_code == 401
    annotate.assert_not_called()


def test_transient_annotation_needs_a_pdf(client, logged_in):
    with patch.object(annotations_blueprint, 'annotate_transient_pdf') as annotate:
        missing = client.post('/filesystem/annotations/transient', data={}, headers=AUTH)
        not_pdf = client.post(
            '/filesystem/annotations/transient', data=upload(b'hello', 'notes.txt'), headers=AUTH)

    assert missing.status_code == 400
    assert not_pdf.status_code == 415
    annotate.assert_not_called()


def test_transient_pdf_is_served_to_the_parser_only_while_annotating(app, client, redis):
    """
    The PDF parser fetches the PDF from a URL; the content must be there while it does,
    and gone afterwards.
    """
    fetched = {}

    def parse_content(content_type, file_url, exclude_references):
        token = file_url.rsplit('/', 1)[1]
        fetched['response'] = client.get(f'/annotations/transient/{token}')
        fetched['token'] = token
        return 'text', []

    class FakePipeline:
        def __init__(self, steps, text, parsed):
            pass

        def get_globals(self, excluded_annotations, custom_annotations):
            return self

        def identify(self, annotation_methods):
            return self

        def annotate(self, **kwargs):
            return {'documents': [{'passages': [{'annotations': [{'keyword': 'x'}]}]}]}

    with patch.object(transient_annotation, 'parse_content', parse_content), \
            patch.object(transient_annotation, 'Pipeline', FakePipeline):
        result = transient_annotation.annotate_transient_pdf(PDF, 'paper.pdf')

    assert result == [{'keyword': 'x'}]
    assert fetched['response'].status_code == 200
    assert fetched['response'].data == PDF
    assert fetched['response'].headers['Content-Type'] == 'application/pdf'
    assert fetched['response'].headers['Cache-Control'] == 'no-store'
    # Discarded once parsed, and set to expire even if it had not been
    assert redis.store == {}
    assert list(redis.expiries.values()) == [transient_files.TRANSIENT_FILE_TTL]
    assert client.get(f'/annotations/transient/{fetched["token"]}').status_code == 404


def test_transient_pdf_is_discarded_when_parsing_fails(redis):
    def failing_parse(content_type, file_url, exclude_references):
        raise RuntimeError('parser down')

    with patch.object(transient_annotation, 'parse_content', failing_parse):
        with pytest.raises(RuntimeError):
            transient_annotation.annotate_transient_pdf(PDF, 'paper.pdf')

    assert redis.store == {}


def test_transient_pdf_url_rejects_unknown_and_malformed_tokens(client, redis):
    token = transient_files.stash_transient_file(PDF)

    assert client.get('/annotations/transient/' + 'x' * 43).status_code == 404
    assert client.get('/annotations/transient/short').status_code == 404
    assert transient_files.read_transient_file('../../etc/passwd') is None
    assert client.get(f'/annotations/transient/{token}').data == PDF


def enrichment_table():
    return {
        'data': {'genes': 'TP53', 'taxId': '9606', 'organism': 'Homo sapiens', 'sources': []},
        'result': {
            'domainInfo': {},
            'genes': [{'imported': 'TP53', 'matched': 'TP53', 'fullName': 'tumor protein p53'}],
        },
    }


def test_transient_enrichment_annotation_returns_the_annotated_table(client, logged_in):
    annotated = enrichment_table()
    annotated['result']['genes'][0]['annotatedMatched'] = '<snippet>TP53</snippet>'
    with patch.object(annotations_blueprint, 'annotate_transient_enrichment_table',
                      return_value=annotated) as annotate:
        response = client.post(
            '/filesystem/annotations/transient/enrichment-table',
            data=upload(json.dumps(enrichment_table()).encode(), 'genes.enrichment',
                        filename='My genes.enrichment'),
            headers=AUTH,
        )

    assert response.status_code == 200
    gene = response.json['results']['result']['genes'][0]
    assert gene['annotatedMatched'] == '<snippet>TP53</snippet>'
    annotate.assert_called_once_with(enrichment_table(), 'My genes.enrichment')


def test_transient_enrichment_annotation_needs_login_and_a_table(client, logged_in):
    with patch.object(annotations_blueprint, 'annotate_transient_enrichment_table') as annotate:
        missing = client.post(
            '/filesystem/annotations/transient/enrichment-table', data={}, headers=AUTH)
        not_json = client.post(
            '/filesystem/annotations/transient/enrichment-table',
            data=upload(b'\xff not json', 'genes.enrichment'), headers=AUTH)
        not_a_table = client.post(
            '/filesystem/annotations/transient/enrichment-table',
            data=upload(b'[1, 2]', 'genes.enrichment'), headers=AUTH)
        anonymous = client.post(
            '/filesystem/annotations/transient/enrichment-table',
            data=upload(b'{}', 'genes.enrichment'))

    assert missing.status_code == 400
    assert not_json.status_code == 400
    assert not_a_table.status_code == 400
    assert anonymous.status_code == 401
    annotate.assert_not_called()


def test_transient_enrichment_annotation_highlights_cells():
    """Annotations of the combined cell text end up as snippets in the cells they came from."""
    gene = {
        'meta': {'type': 'Gene', 'id': '7157', 'allText': 'TP53'},
        'textInDocument': 'TP53',
        'keyword': 'TP53',
        'keywordLength': 4,
        # 'TP53 TP53 tumor protein p53 ': the second TP53 is the Matched cell
        'loLocationOffset': 5,
        'hiLocationOffset': 8,
        'enrichmentDomain': {},
    }
    calls = {}

    class FakePipeline:
        @classmethod
        def parse(cls, content_type, text):
            calls['text'] = text
            return text, []

        def __init__(self, steps, text, parsed):
            pass

        def get_globals(self, excluded_annotations, custom_annotations):
            return self

        def identify(self, annotation_methods):
            return self

        def annotate(self, **kwargs):
            calls['annotate'] = kwargs
            return {'documents': [{'passages': [{'annotations': [gene]}]}]}

    tables = SimpleNamespace(
        create_annotation_mappings=lambda table: EnrichmentTableService.create_annotation_mappings(
            None, table))
    with patch.object(transient_annotation, 'Pipeline', FakePipeline), \
            patch.object(transient_annotation, 'get_enrichment_table_service', return_value=tables):
        result = transient_annotation.annotate_transient_enrichment_table(
            enrichment_table(), 'genes.enrichment')

    assert calls['text'] == 'TP53 TP53 tumor protein p53 '
    assert calls['annotate']['specified_organism_tax_id'] == '9606'
    row = result['result']['genes'][0]
    assert row['annotatedImported'] == '<snippet>TP53</snippet>'
    assert row['annotatedMatched'].startswith('<snippet><annotation type="Gene" meta="')
    assert row['annotatedMatched'].endswith('>TP53</annotation></snippet>')
    assert row['annotatedFullName'] == '<snippet>tumor protein p53</snippet>'
    assert gene['enrichmentDomain'] == {'domain': 'Matched'}


# ---------------------------------------------------------------------------
# Converting without storing
# ---------------------------------------------------------------------------

def test_conversion_converts_office_documents(client, logged_in):
    with patch('neo4japp.blueprints.filesystem.convert_to_pdf',
               return_value=io.BytesIO(b'%PDF-converted')) as convert:
        response = client.post(
            '/filesystem/convert/pdf',
            data=upload(b'PK\x03\x04docx', 'Report v2.docx'),
            headers=AUTH)

    assert response.status_code == 200
    assert response.data == b'%PDF-converted'
    assert response.headers['Content-Type'] == 'application/pdf'
    assert response.headers['Content-Disposition'] == 'inline; filename="Report v2.pdf"'
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    convert.assert_called_once_with(b'PK\x03\x04docx', DOCX)


def test_conversion_uses_the_given_mime_type(client, logged_in):
    with patch('neo4japp.blueprints.filesystem.convert_to_pdf',
               return_value=io.BytesIO(b'%PDF-converted')) as convert:
        client.post(
            '/filesystem/convert/pdf',
            data=upload(b'data', 'export', mimeType='application/vnd.ms-excel'),
            headers=AUTH)

    convert.assert_called_once_with(b'data', 'application/vnd.ms-excel')


def test_conversion_never_echoes_the_upload(client, logged_in):
    """PDFs are opened directly by the client; the endpoint only returns converted output."""
    with patch('neo4japp.blueprints.filesystem.convert_to_pdf') as convert:
        response = client.post(
            '/filesystem/convert/pdf', data=upload(PDF, 'paper.pdf'), headers=AUTH)

    assert response.status_code == 415
    assert PDF not in response.data
    convert.assert_not_called()


def test_conversion_refuses_unsupported_files(client, logged_in):
    with patch('neo4japp.blueprints.filesystem.convert_to_pdf') as convert:
        response = client.post(
            '/filesystem/convert/pdf', data=upload(b'\x89PNG', 'figure.png'), headers=AUTH)

    assert response.status_code == 415
    convert.assert_not_called()


def test_conversion_reports_missing_libreoffice(client, logged_in):
    with patch('neo4japp.blueprints.filesystem.convert_to_pdf',
               side_effect=RuntimeError('LibreOffice is not installed')):
        response = client.post(
            '/filesystem/convert/pdf', data=upload(b'doc', 'a.docx'), headers=AUTH)

    assert response.status_code == 503


def test_conversion_reports_an_unconvertible_document(client, logged_in):
    """LibreOffice is there but makes nothing of the file: the file is at fault."""
    with patch('neo4japp.blueprints.filesystem.convert_to_pdf',
               side_effect=ConversionFailedError('no PDF in /tmp/mycelium_lo_x')):
        response = client.post(
            '/filesystem/convert/pdf', data=upload(b'PK\x03\x04', 'a.docx'), headers=AUTH)

    assert response.status_code == 422
    assert b'/tmp/' not in response.data


@pytest.mark.skipif(shutil.which('soffice') is None, reason='LibreOffice is not installed')
def test_libreoffice_fails_to_convert_a_corrupt_document():
    """soffice exits cleanly for a damaged .docx, but writes no PDF."""
    with pytest.raises(ConversionFailedError):
        convert_to_pdf(b'PK\x03\x04garbage', DOCX)


def test_conversion_needs_login(client):
    response = client.post('/filesystem/convert/pdf', data=upload(b'doc', 'a.docx'))
    assert response.status_code == 401


def test_mime_type_for_filename():
    assert mime_type_for_filename('Report.DOCX') == DOCX
    assert mime_type_for_filename('slides.odp') == 'application/vnd.oasis.opendocument.presentation'
    assert mime_type_for_filename('figure.png') is None
    assert mime_type_for_filename('') is None
