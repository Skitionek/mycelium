"""
Integration tests for the DMP CRUD blueprint (neo4japp/blueprints/dmp.py),
using the vendored RDA-DMP-Common fixtures from docs/dmp-schema/fixtures/
(produced by task t_bf70edbb) to exercise the real validation service.
"""
import copy
import glob
import json
import os

import pytest

from neo4japp.models import DMP
from tests.helpers.api import generate_jwt_headers

FIXTURES_ROOT = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '..', '..', '..',
        'docs', 'dmp-schema', 'fixtures',
    )
)


def _load_fixture(*parts):
    with open(os.path.join(FIXTURES_ROOT, *parts)) as f:
        return json.load(f)


def _valid_fixture_files():
    return sorted(glob.glob(os.path.join(FIXTURES_ROOT, 'valid', '*.json')))


def _invalid_fixture_files():
    return sorted(glob.glob(os.path.join(FIXTURES_ROOT, 'invalid', '*.json')))


@pytest.fixture(scope='function')
def auth_headers(client, test_user):
    login_resp = client.login_as_user('test@mycelium.bio', 'password')
    return generate_jwt_headers(login_resp['accessToken']['token'])


@pytest.fixture(scope='function')
def valid_dmp_payload():
    return _load_fixture('valid', 'ex1-header-fundedProject.json')


def test_all_valid_fixtures_are_accepted(client, session, auth_headers):
    for path in _valid_fixture_files():
        with open(path) as f:
            payload = json.load(f)
        resp = client.post(
            '/dmp',
            headers=auth_headers,
            data=json.dumps(payload),
            content_type='application/json',
        )
        assert resp.status_code == 201, (
            f'{os.path.basename(path)} should be accepted: {resp.get_json()}'
        )


def test_all_invalid_fixtures_are_rejected(client, session, auth_headers):
    for path in _invalid_fixture_files():
        with open(path) as f:
            payload = json.load(f)
        resp = client.post(
            '/dmp',
            headers=auth_headers,
            data=json.dumps(payload),
            content_type='application/json',
        )
        assert resp.status_code == 400, (
            f'{os.path.basename(path)} should be rejected'
        )
        body = resp.get_json()
        # actionable per-field errors
        assert body.get('fields'), body


def test_post_then_get_returns_document_unchanged(client, session, auth_headers,
                                                    valid_dmp_payload):
    post_resp = client.post(
        '/dmp',
        headers=auth_headers,
        data=json.dumps(valid_dmp_payload),
        content_type='application/json',
    )
    assert post_resp.status_code == 201
    created = post_resp.get_json()
    hash_id = created['hashId']

    get_resp = client.get(f'/dmp/{hash_id}', headers=auth_headers)
    assert get_resp.status_code == 200
    fetched = get_resp.get_json()

    assert fetched['jsonData'] == valid_dmp_payload
    assert fetched['hashId'] == hash_id


def test_patch_edits_with_validation(client, session, auth_headers, valid_dmp_payload):
    post_resp = client.post(
        '/dmp',
        headers=auth_headers,
        data=json.dumps(valid_dmp_payload),
        content_type='application/json',
    )
    hash_id = post_resp.get_json()['hashId']

    patch_resp = client.patch(
        f'/dmp/{hash_id}',
        headers=auth_headers,
        data=json.dumps({'dmp': {'title': 'An updated title'}}),
        content_type='application/json',
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.get_json()
    assert updated['jsonData']['dmp']['title'] == 'An updated title'
    # untouched fields survive the shallow merge
    assert updated['jsonData']['dmp']['dmp_id'] == valid_dmp_payload['dmp']['dmp_id']


def test_patch_with_invalid_edit_is_rejected(client, session, auth_headers, valid_dmp_payload):
    post_resp = client.post(
        '/dmp',
        headers=auth_headers,
        data=json.dumps(valid_dmp_payload),
        content_type='application/json',
    )
    hash_id = post_resp.get_json()['hashId']

    patch_resp = client.patch(
        f'/dmp/{hash_id}',
        headers=auth_headers,
        data=json.dumps({'dmp': {'ethical_issues_exist': 'maybe'}}),
        content_type='application/json',
    )
    assert patch_resp.status_code == 400

    # original document is untouched
    get_resp = client.get(f'/dmp/{hash_id}', headers=auth_headers)
    assert get_resp.get_json()['jsonData'] == valid_dmp_payload


def test_put_replaces_document(client, session, auth_headers, valid_dmp_payload):
    post_resp = client.post(
        '/dmp',
        headers=auth_headers,
        data=json.dumps(valid_dmp_payload),
        content_type='application/json',
    )
    hash_id = post_resp.get_json()['hashId']

    replacement = _load_fixture('valid', 'ex8-dmp-minimal-content.json')
    put_resp = client.put(
        f'/dmp/{hash_id}',
        headers=auth_headers,
        data=json.dumps(replacement),
        content_type='application/json',
    )
    assert put_resp.status_code == 200
    assert put_resp.get_json()['jsonData'] == replacement


def test_delete_removes_document(client, session, auth_headers, valid_dmp_payload):
    post_resp = client.post(
        '/dmp',
        headers=auth_headers,
        data=json.dumps(valid_dmp_payload),
        content_type='application/json',
    )
    hash_id = post_resp.get_json()['hashId']

    delete_resp = client.delete(f'/dmp/{hash_id}', headers=auth_headers)
    assert delete_resp.status_code == 204

    get_resp = client.get(f'/dmp/{hash_id}', headers=auth_headers)
    assert get_resp.status_code == 404

    assert session.query(DMP).filter_by(hash_id=hash_id).one_or_none() is None


def test_get_missing_document_returns_404(client, session, auth_headers):
    resp = client.get('/dmp/does-not-exist', headers=auth_headers)
    assert resp.status_code == 404


def test_list_returns_created_documents(client, session, auth_headers, valid_dmp_payload):
    client.post(
        '/dmp',
        headers=auth_headers,
        data=json.dumps(valid_dmp_payload),
        content_type='application/json',
    )
    resp = client.get('/dmp', headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['total'] >= 1
    assert any(
        r['jsonData']['dmp']['dmp_id'] == valid_dmp_payload['dmp']['dmp_id']
        for r in body['results']
    )
