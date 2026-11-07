from sqlalchemy import text

from neo4japp.database import db
from neo4japp.models import AppUser

# Regression cover for #619. The `session` fixture binds a session to one
# connection with an open transaction and rolls it back on teardown. If the
# session is not actually on that connection, a service that commits for itself
# writes to a pooled connection instead, the rollback never reaches it, and the
# row survives into the next test.
#
# A high id keeps these out of the way of the hardcoded ids the other database
# fixtures use.
LEAK_PROBE_ID = 990001


def make_probe_user():
    user = AppUser(
        id=LEAK_PROBE_ID,
        username='session_rollback_probe',
        email='session-rollback-probe@mycelium.bio',
        first_name='Probe',
        last_name='User',
    )
    user.set_password('probe-password')
    return user


def count_probe_rows_on_another_connection():
    """
    Count the probe rows as a separate connection sees them.

    A second connection cannot see inside the fixture's open transaction, so
    anything it finds has genuinely been committed to the database.
    """
    with db.engine.connect() as other_connection:
        return other_connection.execute(
            text('SELECT count(*) FROM appuser WHERE id = :id'),
            {'id': LEAK_PROBE_ID},
        ).scalar()


def test_a_commit_through_the_session_stays_inside_the_fixture_transaction(session):
    """
    This is the property the fixture is supposed to guarantee, and the one
    that was silently false: committing must not escape the transaction the
    fixture will roll back.
    """
    # Given a row committed through the session, the way the service layer does
    session.add(make_probe_user())
    session.commit()

    # When a connection outside the fixture's transaction looks for it
    committed_rows = count_probe_rows_on_another_connection()

    # Then it is not there -- the commit was contained
    assert committed_rows == 0


def test_the_previous_test_left_no_rows_behind(session):
    """
    The leak as it actually bit: the next test in the file collided with rows
    the previous one committed.
    """
    # Given the preceding test committed a row and then ended

    # When this test looks for it, both through the session and outside it
    rows_in_session = session.query(AppUser).filter(AppUser.id == LEAK_PROBE_ID).count()
    rows_committed = count_probe_rows_on_another_connection()

    # Then the rollback removed every trace
    assert rows_in_session == 0
    assert rows_committed == 0
