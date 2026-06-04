"""API tests for folder-level .annotations config via the standard file API."""
import json
import types

import pytest

from neo4japp.models import (
    AppUser,
    Files,
    Projects,
    AppRole,
    projects_collaborator_role,
)
from neo4japp.services.file_types.providers import DirectoryTypeProvider
from neo4japp.services.elastic import SearchIndexService
from datetime import datetime


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope='function')
def mock_elastic(monkeypatch):
    monkeypatch.setattr(SearchIndexService, 'index_files', lambda *a, **kw: None)
    monkeypatch.setattr(SearchIndexService, 'delete_files', lambda *a, **kw: None)
    monkeypatch.setattr(SearchIndexService, 'index_maps', lambda *a, **kw: None)


@pytest.fixture(scope='function')
def fix_admin_role_fa(session):
    from neo4japp.services import AccountService
    svc = AccountService()
    return svc.get_or_create_role('admin')


@pytest.fixture(scope='function')
def fix_superuser_role_fa(session):
    from neo4japp.services import AccountService
    svc = AccountService()
    return svc.get_or_create_role('private-data-access')


@pytest.fixture(scope='function')
def admin_user(session, fix_admin_role_fa, fix_superuser_role_fa) -> AppUser:
    user = AppUser(
        id=501,
        username='fa_admin',
        email='fa_admin@mycelium.bio',
        first_name='FA',
        last_name='Admin',
    )
    user.set_password('password')
    user.roles.extend([fix_admin_role_fa, fix_superuser_role_fa])
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def fix_folder(session, admin_user) -> Files:
    """A root directory with its project."""
    root = Files(
        filename='/',
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        user=admin_user,
    )
    project = Projects(
        name='folder-annot-test',
        description='test',
        root=root,
        creation_date=datetime.now(),
    )
    session.add(root)
    session.add(project)
    session.flush()

    role = AppRole.query.filter(AppRole.name == 'project-admin').one()
    session.execute(
        projects_collaborator_role.insert(),
        [{'appuser_id': admin_user.id, 'app_role_id': role.id, 'projects_id': project.id}],
    )
    session.flush()
    return root


def login_as_user(self, email, password):
    resp = self.post(
        '/auth/login',
        data=json.dumps({'email': email, 'password': password}),
        content_type='application/json',
    )
    return resp.get_json()


@pytest.fixture(scope='function')
def client(app):
    c = app.test_client()
    c.login_as_user = types.MethodType(login_as_user, c)
    return c


# ---------------------------------------------------------------------------
# Tests: GET effective-annotations-config
# ---------------------------------------------------------------------------

class TestEffectiveAnnotationsConfig:
    def test_returns_empty_config_with_no_annotations(
            self, client, admin_user, fix_folder, mock_elastic, session):
        resp_login = client.login_as_user(admin_user.email, 'password')
        headers = generate_headers(resp_login['accessToken']['token'])
        hash_id = fix_folder.hash_id

        response = client.get(
            f'/filesystem/objects/{hash_id}/effective-annotations-config',
            headers=headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('customAnnotations', []) == []
        assert data.get('excludedAnnotations', []) == []
