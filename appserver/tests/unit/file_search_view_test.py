"""Searching public and linked files, with the database stubbed out."""
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask, g
from sqlalchemy.dialects import postgresql

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.filesystem import FileSearchView
from neo4japp.factory import register_error_handlers
from neo4japp.models import AppUser

HEADERS = {'Authorization': 'Bearer token'}

# A query for a single column pages through rows, not bare values
PAGE_OF_ROWS = MagicMock(items=[(7,), (9,)], total=2)


@pytest.fixture
def looked_up_filters():
    return []


@pytest.fixture
def client(looked_up_filters):
    app = Flask(__name__)
    register_error_handlers(app)
    app.add_url_rule('/filesystem/search', view_func=FileSearchView.as_view('file_search'))
    current_user = AppUser(id=1, hash_id='self-hash-id', username='admin')

    def verify_token(token):
        g.current_user = current_user
        return current_user

    def record_lookup(self, filter, *args, **kwargs):
        looked_up_filters.append(filter)
        return []

    with (
        patch.object(auth, 'verify_token_callback', verify_token),
        patch('neo4japp.blueprints.filesystem.db') as db,
        patch.object(FileSearchView, 'get_nondeleted_recycled_files', record_lookup),
        patch.object(FileSearchView, 'get_nondeleted_recycled_file', return_value=MagicMock(id=3)),
        patch.object(FileSearchView, 'check_file_permissions'),
    ):
        query = db.session.query.return_value
        query.filter.return_value.order_by.return_value.paginate.return_value = PAGE_OF_ROWS
        query.filter.return_value.paginate.return_value = PAGE_OF_ROWS
        yield app.test_client()


def compiled(filter):
    return str(filter.compile(dialect=postgresql.dialect(),
                              compile_kwargs={'literal_binds': True}))


# POST /filesystem/search

def test_public_search_looks_files_up_by_their_ids(client, looked_up_filters):
    # Given a page of public file rows
    body = {'type': 'public', 'sort': 'filename'}

    # When public files are searched
    response = client.post('/filesystem/search', json=body, headers=HEADERS)

    # Then the files are looked up by plain ids, which Postgres can bind
    assert response.status_code == 200, response.get_json()
    assert compiled(looked_up_filters[0]).endswith('IN (7, 9)')


def test_linked_search_looks_maps_up_by_their_ids(client, looked_up_filters):
    # Given a page of rows for the maps that link to a file
    body = {'type': 'linked', 'linkedHashId': 'linked-file-hash-id'}

    # When the maps linking to the file are searched
    response = client.post('/filesystem/search', json=body, headers=HEADERS)

    # Then the maps are looked up by plain ids, which Postgres can bind
    assert response.status_code == 200, response.get_json()
    assert compiled(looked_up_filters[0]).endswith('IN (7, 9)')
