import pytest
from marshmallow import Schema, ValidationError

from neo4japp.schemas.fields import NiceFilenameString, StringIntegerField


class IntegerSchema(Schema):
    required = StringIntegerField()
    nullable = StringIntegerField(allow_none=True)
    defaulted = StringIntegerField(load_default=lambda: 5)


@pytest.mark.parametrize('field, value, expected', [
    ('required', '3', 3),
    ('nullable', '3', 3),
    ('nullable', '', None),
    ('defaulted', '', 5),
    ('defaulted', '7', 7),
])
def test_string_integer_field_loads(field, value, expected):
    assert IntegerSchema().load({field: value})[field] == expected


def test_string_integer_field_rejects_an_empty_string_without_default_or_none():
    with pytest.raises(ValidationError) as error:
        IntegerSchema().load({'required': ''})

    assert error.value.messages['required'] == ['Field may not be null.']


def test_string_integer_field_rejects_non_integers():
    with pytest.raises(ValidationError):
        IntegerSchema().load({'required': 'abc'})


@pytest.mark.parametrize('value, expected', [
    ('report.pdf', 'report.pdf'),
    ('  report.pdf \n', 'report.pdf'),
    ('re​port.pdf', 'report.pdf'),
    ('two  words.pdf', 'two  words.pdf'),
    ('no extension', 'no extension'),
])
def test_nice_filename_cleans_up(value, expected):
    assert NiceFilenameString().deserialize(value) == expected


@pytest.mark.parametrize('value', [
    'evil.exe',
    'evil.EXE',
    'evil.exe ',
    'evil.exe​',
    'evil.exe.',
    'evil.exe...',
    'evil.exe. .',
    'evil.bat. ',
])
def test_nice_filename_rejects_executables(value):
    with pytest.raises(ValidationError):
        NiceFilenameString().deserialize(value)
