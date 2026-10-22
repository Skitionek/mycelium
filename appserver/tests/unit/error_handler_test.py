import pytest
from flask import Flask
from werkzeug.exceptions import NotFound

from neo4japp.exceptions import ServerException
from neo4japp.factory import register_error_handlers


# Flask resolves an error handler by walking the raised exception's MRO, so a
# handler registered for Exception also claims every HTTPException unless a
# nearer entry exists. That is how an unmatched URL came to answer 500 instead
# of 404. These tests apply the real register_error_handlers() to a bare app --
# not a copy of it -- so dropping a registration from production code fails
# here.


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test'

    register_error_handlers(app)

    @app.route('/raises-not-found')
    def raises_not_found():
        raise NotFound()

    @app.route('/raises-server-exception')
    def raises_server_exception():
        raise ServerException(title='Nope', message='Not allowed', code=401)

    @app.route('/raises-unexpected')
    def raises_unexpected():
        raise RuntimeError('genuinely unexpected')

    @app.route('/allows-get-only')
    def allows_get_only():
        return {'ok': True}

    return app


def test_unmatched_url_is_reported_as_404(app):
    """A routing miss must keep its own status, not become a 500."""
    # Given an app with the production error handlers
    client = app.test_client()

    # When a URL that matches no route is requested
    response = client.get('/no-such-route')

    # Then the response carries the routing status
    assert response.status_code == 404


def test_raised_not_found_is_reported_as_404(app):
    """An HTTPException raised inside a view keeps its status too."""
    # Given an app with the production error handlers
    client = app.test_client()

    # When a view raises NotFound
    response = client.get('/raises-not-found')

    # Then the status is the exception's own, not the catch-all's
    assert response.status_code == 404


def test_disallowed_method_is_reported_as_405(app):
    """MethodNotAllowed is an HTTPException and must survive as 405."""
    # Given a route registered for GET only
    client = app.test_client()

    # When it is called with POST
    response = client.post('/allows-get-only')

    # Then werkzeug's own status is preserved
    assert response.status_code == 405


def test_server_exception_keeps_its_explicit_code(app):
    """The ServerException handler must still win over the HTTPException one."""
    # Given a view raising ServerException with an explicit code
    client = app.test_client()

    # When it is requested
    response = client.get('/raises-server-exception')

    # Then that code is used
    assert response.status_code == 401


def test_unexpected_exception_is_still_a_500(app):
    """Adding the HTTPException handler must not swallow real faults."""
    # Given a view raising a non-HTTP exception
    client = app.test_client()

    # When it is requested
    response = client.get('/raises-unexpected')

    # Then it is still reported as an internal error
    assert response.status_code == 500


def test_http_error_response_carries_title_and_message(app):
    """The error body keeps the API's shape rather than werkzeug's HTML."""
    # Given an app with the production error handlers
    client = app.test_client()

    # When an unmatched URL is requested
    response = client.get('/no-such-route')
    body = response.get_json()

    # Then the payload is JSON describing the error
    assert body['title'] == NotFound().name
    assert body['message']


def test_http_error_body_has_no_stacktrace_outside_debug(app):
    """Routing errors are expected conditions and need no traceback."""
    # Given the app is not in debug mode
    app.debug = False
    client = app.test_client()

    # When an unmatched URL is requested
    response = client.get('/no-such-route')

    # Then no stacktrace is disclosed
    assert not response.get_json().get('stacktrace')
