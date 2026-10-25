"""Bearer token checks on authenticated endpoints, and token refresh."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import jwt
import pytest
from flask import Flask, g, jsonify
from sqlalchemy.orm.exc import NoResultFound

from neo4japp.blueprints.auth import (
    PasswordResetTokenService,
    TokenService,
    auth,
    bp as auth_bp,
)
from neo4japp.factory import register_error_handlers
from neo4japp.models import AppUser

JWT_SECRET = 'test-secret-long-enough-for-sha256-hmac'
EMAIL = 'known@example.com'


@pytest.fixture
def user():
    user = AppUser(username='known', email=EMAIL, first_name='Known', last_name='User')
    user.set_password('password')
    return user


@pytest.fixture
def app(user):
    app = Flask(__name__)
    app.config['JWT_SECRET'] = JWT_SECRET
    register_error_handlers(app)
    app.register_blueprint(auth_bp)

    @app.get('/protected')
    @auth.login_required
    def protected():
        return jsonify(email=g.current_user.email)

    def query_by_email(email):
        query = MagicMock()
        if email == EMAIL:
            query.one.return_value = user
        else:
            query.one.side_effect = NoResultFound()
        return query

    with patch.object(AppUser, 'query_by_email', side_effect=query_by_email):
        yield app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def tokens():
    return TokenService(JWT_SECRET)


def bearer(token):
    return {'Authorization': f'Bearer {token}'}


def forge(secret=JWT_SECRET, **claims):
    now = datetime.now(timezone.utc)
    payload = {'iat': now, 'exp': now + timedelta(hours=1), 'sub': EMAIL, 'type': 'access'}
    payload.update(claims)
    return jwt.encode(payload, secret, algorithm='HS256')


def test_access_token_authenticates(client, tokens):
    response = client.get('/protected', headers=bearer(tokens.get_access_token(EMAIL)['token']))

    assert response.status_code == 200
    assert response.get_json() == {'email': EMAIL}


def test_missing_token_is_unauthorized(client):
    assert client.get('/protected').status_code == 401


@pytest.mark.parametrize('token', [
    'not-a-jwt',
    forge(secret='another-secret-long-enough-for-sha256-hmac'),
    forge(exp=datetime.now(timezone.utc) - timedelta(minutes=1)),
], ids=['garbage', 'wrong secret', 'expired'])
def test_invalid_access_token_is_unauthorized(client, token):
    assert client.get('/protected', headers=bearer(token)).status_code == 401


def test_expired_token_says_the_session_expired(client):
    expired = forge(exp=datetime.now(timezone.utc) - timedelta(minutes=1))

    response = client.get('/protected', headers=bearer(expired))

    assert 'expired' in response.get_json()['message']


def test_token_of_a_deleted_account_is_unauthorized(client):
    response = client.get('/protected', headers=bearer(forge(sub='gone@example.com')))

    assert response.status_code == 401


def test_refresh_token_does_not_authenticate_requests(client, tokens):
    refresh = tokens.get_refresh_token(EMAIL)['token']

    assert client.get('/protected', headers=bearer(refresh)).status_code == 401


def test_password_reset_token_does_not_authenticate_requests(client, user):
    reset = PasswordResetTokenService(JWT_SECRET).issue(user)

    assert client.get('/protected', headers=bearer(reset)).status_code == 401


@pytest.mark.parametrize('claim', ['type', 'sub'])
def test_token_missing_a_claim_is_unauthorized(client, claim):
    now = datetime.now(timezone.utc)
    payload = {'iat': now, 'exp': now + timedelta(hours=1), 'sub': EMAIL, 'type': 'access'}
    del payload[claim]

    response = client.get('/protected', headers=bearer(jwt.encode(payload, JWT_SECRET)))

    assert response.status_code == 401


def test_refresh_issues_a_new_pair(client, tokens, user):
    with patch('neo4japp.blueprints.auth.AppUser') as app_user:
        app_user.query.filter_by.return_value.one.return_value = user
        response = client.post(
            '/auth/refresh', json={'jwt': tokens.get_refresh_token(EMAIL)['token']})

    assert response.status_code == 200
    body = response.get_json()
    new_access = body['accessToken']['token']
    assert client.get('/protected', headers=bearer(new_access)).status_code == 200


@pytest.mark.parametrize('body', [
    {},
    {'jwt': None},
    {'jwt': 'not-a-jwt'},
], ids=['no token', 'null token', 'garbage'])
def test_refresh_rejects_a_bad_token(client, body):
    assert client.post('/auth/refresh', json=body).status_code == 401


def test_refresh_rejects_an_access_token(client, tokens):
    response = client.post('/auth/refresh', json={'jwt': tokens.get_access_token(EMAIL)['token']})

    assert response.status_code == 401
