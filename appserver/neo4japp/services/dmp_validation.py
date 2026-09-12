"""
Validation service for RDA-DMP-Common maDMP JSON documents.

Loads the vendored JSON Schema 1.2 (docs/dmp-schema/schema/maDMP-schema-1.2.json,
see docs/dmp-schema/README.md and docs/field-mapping.md, produced by task
t_bf70edbb) and validates payloads on create/update, turning schema errors
into a flat list of actionable per-field error dicts.
"""
import json
import os
import threading

import fastjsonschema
from fastjsonschema import JsonSchemaException, JsonSchemaValueException

# repo root is four levels up from this file:
#   appserver/neo4japp/services/dmp_validation.py -> appserver -> <repo root>
_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..')
)
DMP_SCHEMA_PATH = os.path.join(
    _REPO_ROOT, 'docs', 'dmp-schema', 'schema', 'maDMP-schema-1.2.json'
)

# The schema declares a "url" string format that is not one of the formats
# recognized by fastjsonschema (or, per JSON Schema semantics, any format
# vocabulary implementation is free to treat unknown format names as a no-op
# annotation). python-jsonschema behaves this way by default; match it here
# so behavior is consistent with docs/dmp-schema/validate.py.
_CUSTOM_FORMATS = {'url': r'.*'}

_lock = threading.Lock()
_validate_fn = None


def _load_validator():
    global _validate_fn
    if _validate_fn is not None:
        return _validate_fn
    with _lock:
        if _validate_fn is None:
            with open(DMP_SCHEMA_PATH) as f:
                schema = json.load(f)
            _validate_fn = fastjsonschema.compile(schema, formats=_CUSTOM_FORMATS)
    return _validate_fn


class DMPValidationError(Exception):
    """
    Raised when a maDMP document fails schema validation.

    ``errors`` is a list of dicts: {"field": "<json-pointer-ish path>",
    "message": "<human readable message>"} suitable for direct use as a
    per-field API validation error payload.
    """

    def __init__(self, errors):
        self.errors = errors
        super().__init__(
            '; '.join(f"{e['field']}: {e['message']}" for e in errors) or
            'DMP document failed validation'
        )


def _format_path(path):
    if not path:
        return '<root>'
    return '.'.join(str(p) for p in path)


def validate_dmp_document(payload: dict) -> None:
    """
    Validate a maDMP document (expected shape: {"dmp": {...}}) against the
    vendored RDA-DMP-Common JSON Schema 1.2.

    Raises DMPValidationError with a list of per-field errors on failure.
    Returns None on success.
    """
    validate_fn = _load_validator()
    try:
        validate_fn(payload)
    except JsonSchemaValueException as e:
        # fastjsonschema raises on the *first* error only (no multi-error
        # iterator like python-jsonschema's iter_errors). We still surface a
        # precise, actionable field path + message for that first violation.
        errors = [{'field': _format_path(e.path), 'message': e.message}]
        raise DMPValidationError(errors)
    except JsonSchemaException as e:
        raise DMPValidationError([{'field': '<root>', 'message': str(e)}])


def get_dmp_title(payload: dict) -> str:
    """Extract the denormalized title from a maDMP document payload."""
    try:
        return payload['dmp']['title']
    except (KeyError, TypeError):
        return ''
