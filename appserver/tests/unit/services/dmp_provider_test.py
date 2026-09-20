"""Unit tests for the DMP file type provider
(neo4japp.services.file_types.providers.DmpTypeProvider), using the vendored
RDA-DMP-Common fixtures from docs/dmp-schema/fixtures/."""
import glob
import io
import json
import os

import pytest

from neo4japp.services.dmp_validation import DMPValidationError
from neo4japp.services.file_types.providers import DmpTypeProvider

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
    with open(path, 'rb') as f:
        DmpTypeProvider().validate_content(io.BytesIO(f.read()))


@pytest.mark.parametrize('path', _fixtures('invalid'))
def test_invalid_fixtures_fail(path):
    with open(path, 'rb') as f:
        buffer = io.BytesIO(f.read())
    with pytest.raises(DMPValidationError):
        DmpTypeProvider().validate_content(buffer)


def test_can_create():
    assert DmpTypeProvider().can_create() is True


def test_blank_client_template_is_accepted():
    """
    The client seeds a new DMP file with a minimal maDMP document
    (client/src/app/dmp/models/dmp-template.ts). Creation goes through
    validate_content, so that skeleton has to satisfy every required
    property -- including contact.contact_id, which is easy to miss.
    """
    blank = json.dumps({
        'dmp': {
            'title': 'Untitled Data Management Plan',
            'language': 'eng',
            'created': '2026-09-20T20:00:00Z',
            'modified': '2026-09-20T20:00:00Z',
            'dmp_id': {'identifier': 'urn:uuid:0-0-0-0', 'type': 'other'},
            'ethical_issues_exist': 'unknown',
            'contact': {
                'name': 'Unknown',
                'mbox': 'unknown@example.org',
                'contact_id': {'identifier': 'urn:uuid:0-0-0-1', 'type': 'other'},
            },
            'dataset': [{
                'dataset_id': {'identifier': 'urn:uuid:0-0-0-2', 'type': 'other'},
                'title': 'Untitled dataset',
                'personal_data': 'unknown',
                'sensitive_data': 'unknown',
            }],
        },
    })
    DmpTypeProvider().validate_content(io.BytesIO(blank.encode()))
