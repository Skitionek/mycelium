# RDA-DMP-Common maDMP JSON Schema

This directory vendors the official machine-actionable Data Management Plan
(maDMP) JSON Schema, version 1.2, from the RDA-DMP-Common-Standard project:

  <https://github.com/RDA-DMP-Common/RDA-DMP-Common-Standard>

Source file fetched verbatim (unmodified) from:
  examples/JSON/JSON-schema/1.2/maDMP-schema-1.2.json

## Contents

  schema/maDMP-schema-1.2.json   JSON Schema (draft 2020-12), root object
                                  { "dmp": <DMPData> }, required.
  fixtures/valid/*.json          Official example maDMP documents (ex1-ex10)
                                  taken verbatim from the standard's
                                  examples/JSON directory. All validate.
  fixtures/invalid/*.json        Hand-authored malformed documents used to
                                  confirm the schema rejects bad input:
                                    - missing-required-fields.json: dmp
                                      object present but missing contact,
                                      created, dmp_id, ethical_issues_exist,
                                      language, modified
                                    - no-dmp-wrapper.json: fields placed at
                                      document root instead of nested under
                                      "dmp"
                                    - wrong-type-ethical-issues.json: uses a
                                      free-text string ("maybe") for
                                      ethical_issues_exist instead of the
                                      required enum (yes|no|unknown)
  validate.py                    Standalone script (uses the `jsonschema`
                                  package) that validates every fixture and
                                  exits non-zero on any mismatch between
                                  expected/actual outcome.
  docs/field-mapping.md          Field-by-field mapping of the top-level dmp
                                  object to the standard.

## Running validation

  python3 -m venv venv
  venv/bin/pip install jsonschema
  venv/bin/python validate.py

Expected output: every fixtures/valid/*.json file passes, every
fixtures/invalid/*.json file is correctly rejected, final line "ALL OK".

## Using in application code (Python / marshmallow-flask appserver)

  import json
  import jsonschema

  with open("schema/maDMP-schema-1.2.json") as f:
      SCHEMA = json.load(f)

  def validate_dmp(payload: dict) -> list[str]:
      validator = jsonschema.validators.validator_for(SCHEMA)(SCHEMA)
      return [f"{'/'.join(str(p) for p in e.path)}: {e.message}"
              for e in validator.iter_errors(payload)]

This returns a flat list of "path: message" strings suitable for turning
into per-field API validation errors in the CRUD endpoint task
(t_82809004) — join on "/" to build a JSON-pointer-ish path, or walk
e.absolute_path for a list-of-keys per error.

## Notes for the CRUD/UI follow-up tasks

- Top-level document is always { "dmp": {...} }; do not flatten the
    wrapper away when persisting/serializing.
- Required dmp fields per 1.2: contact, created, dataset, dmp_id,
    ethical_issues_exist, language, modified, title.
- dataset[].personal_data / sensitive_data / dmp.ethical_issues_exist are
    all a shared "Booleanish" enum: yes | no | unknown (not JSON booleans).
- created/modified use full ISO 8601 date-time with timezone (format:
    date-time); many sub-objects (e.g. project start/end,
    distribution.available_until) use date-only (format: date).
- See docs/field-mapping.md for the complete property table.
