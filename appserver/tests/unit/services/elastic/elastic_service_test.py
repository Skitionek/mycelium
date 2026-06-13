import pytest

from neo4japp.exceptions import ServerException
from neo4japp.services.elastic.elastic_service import SearchIndexService


def make_service() -> SearchIndexService:
    service = SearchIndexService.__new__(SearchIndexService)
    service.search_index_client = {
        'base_url': 'http://solr.example/solr',
        'request_timeout': 10,
    }
    return service


def test_pre_process_query_inserts_and_between_unstacked_terms():
    service = make_service()

    assert service._pre_process_query('alpha beta') == 'alpha and beta'
    assert service._pre_process_query('"alpha beta" gamma') == '"alpha beta" and gamma'


def test_pre_process_query_rejects_malformed_operator_sequence():
    service = make_service()

    with pytest.raises(ServerException, match='malformed'):
        service._pre_process_query('alpha AND OR beta')


def test_convert_filter_clause_maps_fields_and_bool_values():
    service = make_service()

    clause = {
        'bool': {
            'must': [
                {'term': {'public': True}},
                {
                    'bool': {
                        'must_not': [
                            {'term': {'mime_type': 'vnd.lifelike.folder'}},
                        ]
                    }
                },
            ]
        }
    }

    assert service._convert_filter_clause(clause) == (
        '(public_b:true AND NOT (mime_type_s:"vnd.lifelike.folder"))'
    )


def test_convert_filter_clause_rejects_unsupported_field():
    service = make_service()

    with pytest.raises(ServerException, match='Unsupported search filter'):
        service._convert_filter_clause({'term': {'type': 'pdf'}})


def test_search_builds_solr_request_and_maps_results(monkeypatch):
    service = make_service()
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                'response': {
                    'numFound': 1,
                    'docs': [
                        {'id': 'abc123', 'id_i': 77, 'score': 3.5},
                    ],
                },
                'highlighting': {
                    'abc123': {
                        'data_content_txt': ['foo @@@@$bar@@@@/$ baz'],
                    }
                },
            }

    def fake_request(method, url, **kwargs):
        captured['method'] = method
        captured['url'] = url
        captured['kwargs'] = kwargs
        return FakeResponse()

    monkeypatch.setattr(service, '_request', fake_request)

    result, phrases = service.search(
        index_id='files',
        user_search_query='foo bar',
        text_fields=['description', 'data.content', 'filename'],
        text_field_boosts={'filename': 3},
        return_fields=['id'],
        offset=2,
        limit=5,
        filter_=[
            {'term': {'public': True}},
            {'terms': {'project_id': [1, 2]}},
        ],
        highlight={
            'fragment_size': 120,
            'number_of_fragments': 2,
            'pre_tags': ['<mark>'],
            'post_tags': ['</mark>'],
        },
    )

    assert captured['method'] == 'get'
    assert captured['url'] == 'http://solr.example/solr/files/select'

    params = captured['kwargs']['params']
    assert ('q', 'foo and bar') in params
    assert ('qf', 'description_txt^1 data_content_txt^1 filename_txt^3') in params
    assert ('start', 2) in params
    assert ('rows', 5) in params
    assert ('hl.simple.pre', '<mark>') in params
    assert ('hl.simple.post', '</mark>') in params
    assert ('fq', 'public_b:true') in params
    assert ('fq', '(project_id_i:1 OR project_id_i:2)') in params

    assert set(phrases) == {'foo', 'bar'}
    assert result == {
        'hits': {
            'total': 1,
            'hits': [
                {
                    '_id': 'abc123',
                    '_score': 3.5,
                    'fields': {'id': [77]},
                    'highlight': {'data.content': ['foo @@@@$bar@@@@/$ baz']},
                }
            ],
        }
    }


def test_search_uses_match_all_for_empty_query(monkeypatch):
    service = make_service()
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {'response': {'numFound': 0, 'docs': []}, 'highlighting': {}}

    def fake_request(method, url, **kwargs):
        captured['params'] = kwargs['params']
        return FakeResponse()

    monkeypatch.setattr(service, '_request', fake_request)

    result, phrases = service.search(
        index_id='files',
        user_search_query='',
        text_fields=['filename'],
        text_field_boosts={},
        return_fields=['id'],
    )

    assert ('q', '*:*') in captured['params']
    assert phrases == []
    assert result['hits']['total'] == 0


def test_search_wraps_solr_errors(monkeypatch):
    service = make_service()

    def fake_request(method, url, **kwargs):
        raise RuntimeError('network broken')

    monkeypatch.setattr(service, '_request', fake_request)

    with pytest.raises(ServerException, match='Something went wrong during content search'):
        service.search(
            index_id='files',
            user_search_query='foo',
            text_fields=['filename'],
            text_field_boosts={},
            return_fields=['id'],
        )
