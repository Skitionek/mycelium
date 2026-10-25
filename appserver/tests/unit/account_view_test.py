"""Listing and searching user accounts, with the database stubbed out."""
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask, g
from sqlalchemy.dialects import postgresql

from neo4japp.blueprints.account import bp as account_bp
from neo4japp.blueprints.auth import auth
from neo4japp.factory import register_error_handlers
from neo4japp.models import AppRole, AppUser


def make_user(*roles):
    user = AppUser(
        id=1,
        hash_id='self-hash-id',
        username='admin',
        email='admin@example.com',
        first_name='Ad',
        last_name='Min',
    )
    user.roles = [AppRole(name=role) for role in roles]
    return user


@pytest.fixture
def db():
    with patch('neo4japp.blueprints.account.db') as db:
        yield db


@pytest.fixture
def client(db):
    app = Flask(__name__)
    register_error_handlers(app)
    app.register_blueprint(account_bp)
    current_user = make_user('admin')

    def verify_token(token):
        g.current_user = current_user
        return current_user

    authorization = MagicMock()
    authorization.has_role.return_value = False

    with (
        patch.object(auth, 'verify_token_callback', verify_token),
        patch('neo4japp.blueprints.account.get_authorization_service',
              return_value=authorization),
    ):
        yield app.test_client()


HEADERS = {'Authorization': 'Bearer token'}


# ---------------------------------------------------------------------------
# GET /accounts/
# ---------------------------------------------------------------------------

def executed_query(db):
    (query,), _ = db.session.execute.call_args
    return str(query.compile(dialect=postgresql.dialect()))


def test_list_users_runs_a_query_postgres_accepts(client, db):
    """
    select() took its columns as a list under SQLAlchemy 1; SQLAlchemy 2
    rejects that, and the admin user list answered 500.
    """
    db.session.execute.return_value.fetchall.return_value = [
        (2, 'hash-2', 'jane', 'jane@example.com', 'Jane', 'Doe', 0, 'admin,user'),
    ]

    response = client.get('/accounts/', headers=HEADERS)

    assert response.status_code == 200
    sql = executed_query(db)
    assert 'string_agg' in sql
    assert 'LEFT OUTER JOIN' in sql
    assert response.get_json()['results'] == [{
        'id': 2,
        'hashId': 'hash-2',
        'username': 'jane',
        'email': 'jane@example.com',
        'firstName': 'Jane',
        'lastName': 'Doe',
        'locked': False,
        'roles': ['admin', 'user'],
    }]


def test_get_one_user_filters_by_hash_id(client, db):
    db.session.execute.return_value.fetchall.return_value = []

    response = client.get('/accounts/hash-2', headers=HEADERS)

    assert response.status_code == 200
    assert 't_appuser.hash_id = ' in executed_query(db)


# ---------------------------------------------------------------------------
# POST /accounts/search
# ---------------------------------------------------------------------------

def test_search_takes_search_and_pagination_fields_in_one_body(client, db):
    """
    Both argument schemas read the same JSON body, so each sees the other's
    fields. Unless they ignore unknown fields, every search answers 422.
    """
    paginate = db.session.query.return_value.filter.return_value.filter.return_value.paginate
    paginate.return_value.total = 0
    paginate.return_value.items = []

    response = client.post('/accounts/search', headers=HEADERS, json={
        'query': 'jane',
        'excludeSelf': True,
        'page': 2,
        'limit': 5,
    })

    assert response.status_code == 200
    assert response.get_json() == {'total': 0, 'results': []}
    # Flask-SQLAlchemy 3 takes pagination arguments by keyword only.
    paginate.assert_called_once_with(page=2, per_page=5, error_out=False)
