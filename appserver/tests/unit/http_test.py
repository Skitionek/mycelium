from email.message import EmailMessage

import pytest
from flask import Flask, request

from neo4japp.utils.http import make_cacheable_file_response


@pytest.fixture
def app():
    return Flask(__name__)


def respond(app, filename='file.pdf', headers=None, **kwargs):
    with app.test_request_context('/', headers=headers or {}):
        return make_cacheable_file_response(request, b'data', 'abc', filename, **kwargs)


def parsed_disposition(response):
    """Content-Disposition as a standards-following client reads it."""
    message = EmailMessage()
    message['Content-Disposition'] = response.headers['Content-Disposition']
    return message['Content-Disposition'].params


def test_sends_the_file_as_a_download(app):
    response = respond(app, mime_type='application/pdf')

    assert response.get_data() == b'data'
    assert response.headers['Content-Type'] == 'application/pdf'
    assert response.headers['Content-Length'] == '4'
    assert response.headers['ETag'] == '"abc"'
    assert response.headers['Cache-Control'] == 'no-cache, max-age=0'
    assert parsed_disposition(response)['filename'] == 'file.pdf'


@pytest.mark.parametrize('if_none_match', ['"abc"', '"xyz", "abc"', '*'])
def test_answers_not_modified_for_a_matching_etag(app, if_none_match):
    body, status, headers = respond(app, headers={'If-None-Match': if_none_match})

    assert status == 304
    assert body == ''
    assert headers['ETag'] == '"abc"'


def test_sends_the_file_for_a_stale_etag(app):
    response = respond(app, headers={'If-None-Match': '"xyz"'})

    assert response.status_code == 200
    assert response.get_data() == b'data'


@pytest.mark.parametrize('filename', [
    'plain.pdf',
    'with space.pdf',
    'a "quoted" name.pdf',
    'back\\slash.pdf',
    'semi;colon.pdf',
    'trailing\\',
])
def test_ascii_fallback_filename_survives_parsing(app, filename):
    response = respond(app, filename=filename)

    disposition = response.headers['Content-Disposition']
    fallback = disposition.split('filename="', 1)[1].rsplit('"; filename*=', 1)[0]
    unescaped = fallback.replace('\\"', '"').replace('\\\\', '\\')
    assert unescaped == filename


def test_utf8_filename_is_sent_percent_encoded(app):
    response = respond(app, filename='日本 語.pdf')

    disposition = response.headers['Content-Disposition']
    assert "filename*=UTF-8''%E6%97%A5%E6%9C%AC%20%E8%AA%9E.pdf" in disposition
