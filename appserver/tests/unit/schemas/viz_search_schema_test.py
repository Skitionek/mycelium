import pytest
from marshmallow import ValidationError

from neo4japp.schemas.search import VizSearchSchema


# VizSearchSchema feeds `visualizer_search` through webargs' @use_kwargs, which
# passes one keyword argument per key the schema returns. The view declares
# `domains` and `entities` as required positional parameters, so if the schema
# can validate a payload without producing those keys, the call raises
# TypeError and the endpoint 500s. These tests pin the schema to the view's
# signature.


def test_optional_list_fields_default_to_empty_lists():
    """Omitting domains/entities must still yield both keys."""
    # Given a payload with only the fields the schema marks required
    payload = {
        'query': 'ace2',
        'page': 1,
        'limit': 10,
        'organism': '',
    }

    # When the schema loads it
    result = VizSearchSchema().load(payload)

    # Then the optional list fields are present and empty, because the search
    # DAO treats an empty list as "no filter, search all domains/entities"
    assert result['domains'] == []
    assert result['entities'] == []


def test_load_supplies_every_required_view_argument():
    """A minimal valid payload must cover all of the view's parameters."""
    # Given the parameters visualizer_search() declares
    view_arguments = {'query', 'page', 'limit', 'domains', 'entities', 'organism'}

    # And a payload carrying only the schema's required fields
    payload = {
        'query': 'ace2',
        'page': 1,
        'limit': 10,
        'organism': '',
    }

    # When the schema loads it
    result = VizSearchSchema().load(payload)

    # Then every view parameter is present, so @use_kwargs can bind them all
    assert view_arguments.issubset(result.keys())


def test_supplied_list_values_are_preserved():
    """Explicit domains/entities must pass through untouched."""
    # Given a payload that sets both list fields
    payload = {
        'query': 'ace2',
        'page': 1,
        'limit': 10,
        'organism': '9606',
        'domains': ['chebi', 'go'],
        'entities': ['gene', 'protein'],
    }

    # When the schema loads it
    result = VizSearchSchema().load(payload)

    # Then the values are unchanged
    assert result['domains'] == ['chebi', 'go']
    assert result['entities'] == ['gene', 'protein']


def test_genuinely_required_fields_still_raise():
    """Making the list fields optional must not loosen the required ones."""
    # Given a payload missing the required `query`
    payload = {
        'page': 1,
        'limit': 10,
        'organism': '',
    }

    # When the schema loads it
    # Then validation still fails, yielding a 400 rather than a 500
    with pytest.raises(ValidationError) as error:
        VizSearchSchema().load(payload)

    assert 'query' in error.value.messages
