"""The app's JSON responses: its own types first, then whatever Flask serializes."""
import json
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from flask import Flask

from neo4japp.encoders import CustomJSONProvider


@pytest.fixture
def provider():
    return CustomJSONProvider(Flask(__name__))


def test_serializes_dates_as_flask_does(provider):
    """Creating a user answers with the new user, dates and all; that was a 500."""
    when = datetime(2026, 10, 25, 12, 30, tzinfo=timezone.utc)

    assert json.loads(provider.dumps({'creation_date': when, 'day': date(2026, 10, 25)})) == {
        'creation_date': 'Sun, 25 Oct 2026 12:30:00 GMT',
        'day': 'Sun, 25 Oct 2026 00:00:00 GMT',
    }


def test_serializes_decimals_as_strings(provider):
    assert json.loads(provider.dumps({'score': Decimal('0.25')})) == {'score': '0.25'}


def test_rejects_what_it_cannot_serialize(provider):
    with pytest.raises(TypeError):
        provider.dumps({'value': object()})
