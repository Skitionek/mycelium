"""Unit tests for neo4japp.services.dmp_validation (no DB required)."""
import glob
import json
import os

import pytest

from neo4japp.services.dmp_validation import (
    validate_dmp_document,
    DMPValidationError,
    get_dmp_title,
)

FIXTURES_ROOT = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '..', '..', '..', '..',
        'docs', 'dmp-schema', 'fixtures',
    )
)


def _fixtures(kind):
    return sorted(glob.glob(os.path.join(FIXTURES_ROOT, kind, '*.json')))


@pytest.mark.parametrize('path', _fixtures('valid'))
def test_valid_fixtures_pass(path):
    with open(path) as f:
        payload = json.load(f)
    validate_dmp_document(payload)  # should not raise


@pytest.mark.parametrize('path', _fixtures('invalid'))
def test_invalid_fixtures_fail(path):
    with open(path) as f:
        payload = json.load(f)
    with pytest.raises(DMPValidationError) as exc_info:
        validate_dmp_document(payload)
    assert exc_info.value.errors
    assert all('field' in e and 'message' in e for e in exc_info.value.errors)


def test_get_dmp_title_extracts_title():
    payload = {'dmp': {'title': 'My Plan'}}
    assert get_dmp_title(payload) == 'My Plan'


def test_get_dmp_title_handles_missing():
    assert get_dmp_title({}) == ''
    assert get_dmp_title({'dmp': {}}) == ''
