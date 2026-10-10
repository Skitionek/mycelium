from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import jwt
import pytest
from flask import Flask
from sqlalchemy.orm.exc import NoResultFound

from neo4japp.blueprints.account import bp as account_bp
from neo4japp.blueprints.auth import PasswordResetTokenService
from neo4japp.exceptions import ServerException
from neo4japp.factory import register_error_handlers
from neo4japp.models import AppUser

# The reset endpoint is deliberately unauthenticated so the login page's
# forgot-password flow works, which makes its response the only thing standing
# between an anonymous caller and the answer to "is this address registered?".
# These tests pin that the two cases stay byte-identical, and that a reset link
# cannot be replayed or forged.

# At least 32 bytes, or pyjwt warns about the HMAC key length on every call.
JWT_SECRET = 'test-secret-long-enough-for-sha256-hmac'
KNOWN_EMAIL = 'known@example.com'
UNKNOWN_EMAIL = 'nobody@example.com'


def make_user(email=KNOWN_EMAIL, password='original-password'):
    """An AppUser with a real bcrypt hash, built without touching a database."""
    user = AppUser(
        username='known',
        email=email,
        first_name='Known',
        last_name='User',
    )
    user.set_password(password)
    return user


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test'
    app.config['JWT_SECRET'] = JWT_SECRET

    register_error_handlers(app)
    app.register_blueprint(account_bp)

    return app


@pytest.fixture
def token_service():
    return PasswordResetTokenService(JWT_SECRET)


def lookup_returning(user):
    """Stand in for AppUser.query_by_email, resolving to `user`."""
    query = MagicMock()
    query.one.return_value = user
    return MagicMock(return_value=query)


def lookup_missing():
    """Stand in for AppUser.query_by_email, raising as SQLAlchemy would."""
    query = MagicMock()
    query.one.side_effect = NoResultFound()
    return MagicMock(return_value=query)


# ---------------------------------------------------------------------------
# Account existence disclosure
# ---------------------------------------------------------------------------

def test_known_and_unknown_addresses_get_identical_responses(app):
    """
    The whole point of the endpoint's contract: a caller must not be able to
    tell a registered address from an unregistered one.
    """
    # Given an account that exists and an address that does not
    user = make_user()
    client = app.test_client()

    # When a reset is requested for each
    with patch.object(AppUser, 'query_by_email', lookup_returning(user)), \
            patch('neo4japp.blueprints.account.SENDGRID_API_CLIENT'):
        known = client.get(f'/accounts/{KNOWN_EMAIL}/reset-password')

    with patch.object(AppUser, 'query_by_email', lookup_missing()), \
            patch('neo4japp.blueprints.account.SENDGRID_API_CLIENT'):
        unknown = client.get(f'/accounts/{UNKNOWN_EMAIL}/reset-password')

    # Then the two responses are indistinguishable
    assert known.status_code == 204
    assert unknown.status_code == 204
    assert known.data == unknown.data
    assert known.headers.get('Content-Type') == unknown.headers.get('Content-Type')


def test_response_does_not_echo_the_address(app):
    """The old message interpolated the address, which leaked it back."""
    # Given an address with no account
    client = app.test_client()

    # When a reset is requested for it
    with patch.object(AppUser, 'query_by_email', lookup_missing()), \
            patch('neo4japp.blueprints.account.SENDGRID_API_CLIENT'):
        response = client.get(f'/accounts/{UNKNOWN_EMAIL}/reset-password')

    # Then the address appears nowhere in the response
    assert UNKNOWN_EMAIL.encode() not in response.data


def test_email_send_failure_still_answers_204(app):
    """
    A send failure is only reachable for an address that has an account, so
    surfacing it would reinstate the disclosure.
    """
    # Given an account whose reset email cannot be sent
    user = make_user()
    client = app.test_client()
    sendgrid = MagicMock()
    sendgrid.send.side_effect = Exception('sendgrid is down')

    # When a reset is requested
    with patch.object(AppUser, 'query_by_email', lookup_returning(user)), \
            patch('neo4japp.blueprints.account.SENDGRID_API_CLIENT', sendgrid):
        response = client.get(f'/accounts/{KNOWN_EMAIL}/reset-password')

    # Then the caller still sees the neutral response
    assert response.status_code == 204
    assert response.data == b''


# ---------------------------------------------------------------------------
# The request must not change the account
# ---------------------------------------------------------------------------

def test_requesting_a_reset_leaves_the_password_alone(app):
    """
    The lockout hole: an anonymous request used to overwrite the password, so
    anyone could lock any user out by email address.
    """
    # Given an account with a known password
    user = make_user(password='original-password')
    original_hash = user.password_hash
    client = app.test_client()

    # When an anonymous caller requests a reset
    with patch.object(AppUser, 'query_by_email', lookup_returning(user)), \
            patch('neo4japp.blueprints.account.SENDGRID_API_CLIENT'):
        client.get(f'/accounts/{KNOWN_EMAIL}/reset-password')

    # Then the existing credential is untouched
    assert user.password_hash == original_hash
    assert user.check_password('original-password')


def test_the_emailed_link_points_at_the_frontend_reset_route(app):
    """The email must carry a link, not a password."""
    # Given an account requesting a reset
    user = make_user()
    client = app.test_client()
    sendgrid = MagicMock()

    # When the reset email is built
    with patch.object(AppUser, 'query_by_email', lookup_returning(user)), \
            patch('neo4japp.blueprints.account.SENDGRID_API_CLIENT', sendgrid):
        client.get(f'/accounts/{KNOWN_EMAIL}/reset-password')

    # Then it contains a reset-password link and no plaintext password
    body = sendgrid.send.call_args[0][0].get()['content'][0]['value']
    assert '/reset-password/' in body
    assert 'original-password' not in body


# ---------------------------------------------------------------------------
# PasswordResetTokenService
# ---------------------------------------------------------------------------

def test_a_freshly_issued_token_verifies(app, token_service):
    """Round trip: a token issued for an account resolves back to it."""
    # Given a token issued for an account
    user = make_user()
    token = token_service.issue(user)

    # When it is verified
    with app.app_context(), patch.object(AppUser, 'query_by_email', lookup_returning(user)):
        verified = token_service.verify(token)

    # Then the account comes back
    assert verified is user


def test_a_token_stops_verifying_once_the_password_changes(app, token_service):
    """
    This is what makes the link single-use: the token is signed against the
    password hash it was issued for, and redeeming it replaces that hash.
    """
    # Given a token issued before the password was changed
    user = make_user(password='original-password')
    token = token_service.issue(user)
    user.set_password('a-brand-new-password')

    # When the stale token is verified
    # Then it is rejected
    with app.app_context(), patch.object(AppUser, 'query_by_email', lookup_returning(user)):
        with pytest.raises(ServerException) as rejected:
            token_service.verify(token)

    assert rejected.value.code == 400


def test_an_expired_token_is_rejected(app, token_service):
    """A link left sitting in an inbox must stop working."""
    # Given a token that expired an hour ago
    user = make_user()
    expired_at = datetime.now(timezone.utc) - timedelta(hours=1)
    token = jwt.encode(
        {
            'iat': expired_at - timedelta(minutes=30),
            'exp': expired_at,
            'sub': user.email,
            'type': PasswordResetTokenService.token_type,
            'cred': PasswordResetTokenService._credential_digest(user),
        },
        JWT_SECRET,
        algorithm='HS256',
    )

    # When it is verified
    # Then it is rejected
    with app.app_context(), patch.object(AppUser, 'query_by_email', lookup_returning(user)):
        with pytest.raises(ServerException):
            token_service.verify(token)


def test_a_token_signed_with_another_secret_is_rejected(app, token_service):
    """A forged token must not be spendable."""
    # Given a token signed with the wrong secret
    user = make_user()
    forged = PasswordResetTokenService(
        'not-the-real-secret-but-also-long-enough'
    ).issue(user)

    # When it is verified against the real secret
    # Then it is rejected
    with app.app_context(), patch.object(AppUser, 'query_by_email', lookup_returning(user)):
        with pytest.raises(ServerException):
            token_service.verify(forged)


def test_an_access_token_is_not_spendable_as_a_reset(app, token_service):
    """
    Token type is checked, so a stolen access token cannot be redeemed to
    take over the password.
    """
    # Given a token of the wrong type but otherwise valid
    user = make_user()
    time_now = datetime.now(timezone.utc)
    access_token = jwt.encode(
        {
            'iat': time_now,
            'exp': time_now + timedelta(hours=1),
            'sub': user.email,
            'type': 'access',
            'cred': PasswordResetTokenService._credential_digest(user),
        },
        JWT_SECRET,
        algorithm='HS256',
    )

    # When it is verified
    # Then it is rejected
    with app.app_context(), patch.object(AppUser, 'query_by_email', lookup_returning(user)):
        with pytest.raises(ServerException):
            token_service.verify(access_token)


def test_a_token_for_a_deleted_account_is_rejected(app, token_service):
    """The account may be gone by the time the link is followed."""
    # Given a valid token whose account no longer exists
    user = make_user()
    token = token_service.issue(user)

    # When it is verified
    # Then it is rejected
    with app.app_context(), patch.object(AppUser, 'query_by_email', lookup_missing()):
        with pytest.raises(ServerException):
            token_service.verify(token)


# ---------------------------------------------------------------------------
# Redeeming a reset
# ---------------------------------------------------------------------------

def test_redeeming_a_token_sets_the_new_password(app, token_service):
    """The happy path: the link lets the holder choose a new password."""
    # Given an account and a reset token issued for it
    user = make_user(password='original-password')
    token = token_service.issue(user)
    client = app.test_client()

    # When the token is redeemed with a new password
    with patch.object(AppUser, 'query_by_email', lookup_returning(user)), \
            patch('neo4japp.blueprints.account.db') as mock_db:
        response = client.post(
            '/accounts/reset-password',
            json={'token': token, 'newPassword': 'a-brand-new-password'},
        )

    # Then the new password is in place and the forced-reset flag is cleared
    assert response.status_code == 204
    assert user.check_password('a-brand-new-password')
    assert user.forced_password_reset is False
    mock_db.session.commit.assert_called_once()


def test_a_redeemed_token_cannot_be_used_twice(app, token_service):
    """Replay protection, via the credential the token is bound to."""
    # Given a token that has already been redeemed once
    user = make_user(password='original-password')
    token = token_service.issue(user)
    client = app.test_client()

    with patch.object(AppUser, 'query_by_email', lookup_returning(user)), \
            patch('neo4japp.blueprints.account.db'):
        first = client.post(
            '/accounts/reset-password',
            json={'token': token, 'newPassword': 'a-brand-new-password'},
        )

        # When the same token is redeemed again
        second = client.post(
            '/accounts/reset-password',
            json={'token': token, 'newPassword': 'yet-another-password'},
        )

    # Then only the first attempt succeeded
    assert first.status_code == 204
    assert second.status_code == 400
    assert user.check_password('a-brand-new-password')


def test_a_short_password_is_refused(app, token_service):
    """A new public endpoint should not accept a one-character password."""
    # Given a valid token
    user = make_user()
    token = token_service.issue(user)
    client = app.test_client()

    # When it is redeemed with too short a password
    with patch.object(AppUser, 'query_by_email', lookup_returning(user)), \
            patch('neo4japp.blueprints.account.db'):
        response = client.post(
            '/accounts/reset-password',
            json={'token': token, 'newPassword': 'short'},
        )

    # Then the request is refused and the password is unchanged
    assert response.status_code == 400
    assert user.check_password('original-password')
