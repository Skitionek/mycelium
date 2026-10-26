"""Requesting annotation generation, with file lookups and the database stubbed out."""
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask, g

from neo4japp.blueprints.annotations import FileAnnotationsGenerationView
from neo4japp.blueprints.auth import auth
from neo4japp.factory import register_error_handlers
from neo4japp.models import AppUser


@pytest.fixture
def client():
    app = Flask(__name__)
    register_error_handlers(app)
    app.add_url_rule(
        '/filesystem/annotations/generate',
        view_func=FileAnnotationsGenerationView.as_view('file_annotation_generation'),
    )
    current_user = AppUser(id=1, hash_id='self-hash-id', username='admin')

    def verify_token(token):
        g.current_user = current_user
        return current_user

    view = FileAnnotationsGenerationView
    with (
        patch.object(auth, 'verify_token_callback', verify_token),
        patch.object(view, 'get_nondeleted_recycled_files', return_value=[]),
        patch.object(view, 'check_file_permissions'),
        patch.object(view, 'get_missing_hash_ids', return_value=[]),
        patch('neo4japp.blueprints.annotations.db'),
        patch('neo4japp.blueprints.annotations.get_folder_annotation_service',
              return_value=MagicMock()),
    ):
        yield app.test_client()


HEADERS = {'Authorization': 'Bearer token'}


def test_generation_accepts_an_organism_next_to_the_hash_ids(client):
    # Given a request naming a file and overriding its organism
    body = {
        'hashIds': ['some-file-hash-id'],
        'organism': {
            'organism_name': 'Homo sapiens',
            'synonym': 'Homo sapiens',
            'tax_id': '9606',
        },
    }

    # When the annotations are requested
    response = client.post(
        '/filesystem/annotations/generate', json=body, headers=HEADERS)

    # Then the request is accepted instead of rejected as malformed
    assert response.status_code == 200, response.get_json()
