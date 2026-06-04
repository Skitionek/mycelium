import json

from flask import current_app
from pyparsing import (
    Optional,
    ParserElement,
    QuotedString,
    Word,
    ZeroOrMore,
    printables,
)
import requests
from sqlalchemy import and_
from sqlalchemy.orm import joinedload, raiseload
from typing import Any, Dict, List
from urllib.parse import urlencode

from neo4japp.constants import FILE_INDEX_ID, LogEventType
from neo4japp.database import SearchIndexConnection, GraphConnection
from neo4japp.exceptions import ServerException
from neo4japp.models import Files, Projects
from neo4japp.models.files_queries import build_file_hierarchy_query
from neo4japp.utils import EventLog

ParserElement.enablePackrat()


class SearchIndexService(SearchIndexConnection, GraphConnection):
    ALLOWED_FILTER_FIELDS = frozenset({
        'file_path.tree',
        'mime_type',
        'project_id',
        'public',
    })

    def _collection(self, index_id: str) -> str:
        return index_id

    def _select_url(self, index_id: str) -> str:
        return f'{self.search_index_client["base_url"]}/{self._collection(index_id)}/select'

    def _update_url(self, index_id: str) -> str:
        return f'{self.search_index_client["base_url"]}/{self._collection(index_id)}/update'

    def _extract_url(self, index_id: str) -> str:
        return f'{self._update_url(index_id)}/extract'

    def _request(self, method: str, url: str, **kwargs):
        timeout = self.search_index_client['request_timeout']
        return requests.request(method=method, url=url, timeout=timeout, **kwargs)

    # Begin indexing methods
    def update_or_create_index(self, index_id, index_mapping_file):
        try:
            self._request(
                'post',
                self._update_url(index_id),
                params={'commit': 'true'},
                json={'delete': {'query': '*:*'}},
            ).raise_for_status()
        except Exception as e:
            raise ServerException(
                title='Search Index Error',
                message=f'Failed to recreate Solr collection {index_id}.',
            ) from e
        self.reindex_all_documents()

    def update_or_create_pipeline(self, pipeline_id, pipeline_definition_file):
        # Solr uses the extract handler (Tika) directly and does not require ingest pipelines.
        return 'done'

    def recreate_indices_and_pipelines(self):
        self.update_or_create_index(FILE_INDEX_ID, None)
        return 'done'

    def reindex_all_documents(self):
        self.index_files()

    def update_files(self, hash_ids: List[str] = None):
        raise NotImplementedError()

    def delete_files(self, hash_ids: List[str]):
        self._request(
            'post',
            self._update_url(FILE_INDEX_ID),
            params={'commit': 'true'},
            json={'delete': [{'id': hash_id} for hash_id in hash_ids]},
            headers={'Content-Type': 'application/json'},
        ).raise_for_status()

    def index_files(self, hash_ids: List[str] = None, batch_size: int = 100):
        filters = [
            Files.deletion_date.is_(None),
            Files.recycling_date.is_(None),
        ]

        if hash_ids is not None:
            filters.append(Files.hash_id.in_(hash_ids))

        query = self._get_file_hierarchy_query(and_(*filters))

        if hash_ids is not None:
            query = query.filter(Files.hash_id.in_(hash_ids))

        query = query.with_entities(Files, Projects)
        for file, project in self._windowed_query(query, Files.hash_id, batch_size):
            self._index_file(file, project, FILE_INDEX_ID)

        self._request(
            'post',
            self._update_url(FILE_INDEX_ID),
            params={'commit': 'true'},
            json={},
            headers={'Content-Type': 'application/json'},
        ).raise_for_status()

    def _get_file_hierarchy_query(self, filter):
        return build_file_hierarchy_query(filter, Projects, Files).options(
            raiseload('*'),
            joinedload(Files.user),
            joinedload(Files.content),
        )

    def _windowed_query(self, q, column, windowsize):
        single_entity = q.is_single_entity
        q = q.add_column(column).order_by(column)
        last_id = None

        while True:
            subq = q
            if last_id is not None:
                subq = subq.filter(column > last_id)
            chunk = subq.limit(windowsize).all()
            if not chunk:
                break
            last_id = chunk[-1][-1]
            for row in chunk:
                if single_entity:
                    yield row[0]
                else:
                    yield row[0:-1]

    def _normalize_bool(self, value: bool) -> str:
        return 'true' if value else 'false'

    def _path_tree(self, path: str) -> List[str]:
        parts = [p for p in path.split('/') if p]
        if not parts:
            return ['/']
        acc = []
        current = ''
        for part in parts:
            current = f'{current}/{part}'
            acc.append(current)
        return acc

    def _index_file(self, file: Files, project: Projects, index_id: str):
        content = file.content.raw_file if file.content else None
        literal_fields = {
            'filename_txt': file.filename or '',
            'file_path_s': file.filename_path or '',
            'description_txt': file.description or '',
            'uploaded_date_dt': str(file.creation_date) if file.creation_date else '',
            'user_id_i': file.user_id,
            'username_s': file.user.username if file.user else '',
            'project_id_i': project.id,
            'project_hash_id_s': project.hash_id or '',
            'project_name_txt': project.name or '',
            'doi_s': file.doi or '',
            'public_b': self._normalize_bool(bool(file.public)),
            'id_i': file.id,
            'hash_id_s': file.hash_id,
            'mime_type_s': file.mime_type or '',
            'data_ok_b': self._normalize_bool(True),
            'file_path_ss': self._path_tree(file.filename_path or ''),
        }

        if content:
            try:
                params = {
                    'literal.id': file.hash_id,
                    'fmap.content': 'data_content_txt',
                    'commitWithin': '1000',
                    'overwrite': 'true',
                    'resource.name': file.filename or file.hash_id,
                }
                for key, value in literal_fields.items():
                    if isinstance(value, list):
                        for list_val in value:
                            params.setdefault(f'literal.{key}', [])
                            params[f'literal.{key}'].append(str(list_val))
                    elif value != '':
                        params[f'literal.{key}'] = str(value)

                query = urlencode(params, doseq=True)
                response = self._request(
                    'post',
                    f'{self._extract_url(index_id)}?{query}',
                    files={'file': (file.filename or file.hash_id, content)},
                )
                response.raise_for_status()
                return
            except Exception as e:
                literal_fields['data_ok_b'] = self._normalize_bool(False)
                current_app.logger.error(
                    f'Failed to extract searchable content for file '
                    f'#{file.id} (hash={file.hash_id}, mime type={file.mime_type})',
                    exc_info=e,
                    extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
                )
        doc = {'id': file.hash_id}
        for key, value in literal_fields.items():
            if value != '':
                doc[key] = value
        self._request(
            'post',
            self._update_url(index_id),
            params={'commitWithin': '1000'},
            json={'add': {'doc': doc}},
            headers={'Content-Type': 'application/json'},
        ).raise_for_status()

    # End indexing methods

    # Begin search methods
    def _strip_unmatched_parens(self, s: str) -> str:
        open_paren_indexes = []
        close_paren_indexes = []
        in_quoted_phrase = False
        for i, char in enumerate(s):
            if char == '"':
                in_quoted_phrase = not in_quoted_phrase
                continue
            if in_quoted_phrase:
                continue
            if char == '(':
                open_paren_indexes.append(i)
            if char == ')':
                if len(open_paren_indexes):
                    open_paren_indexes.pop()
                else:
                    close_paren_indexes.append(i)

        unmatched_parens = open_paren_indexes + close_paren_indexes
        unmatched_parens.sort()
        for i, idx in enumerate(unmatched_parens):
            s = s[:idx - i] + s[idx - i + 1:]

        return s

    def _strip_unmatched_quotations(self, s: str) -> str:
        if s.count('"') % 2 == 1:
            odd_quote_idx = s.rfind('"')
            return s[:odd_quote_idx] + s[odd_quote_idx + 1:]
        return s

    def _strip_unmatched_characters(self, s: str) -> str:
        s = self._strip_unmatched_quotations(s)
        s = self._strip_unmatched_parens(s)
        return s

    def _strip_reserved_characters(self, s: str) -> str:
        return ''.join([c for c in s if c not in ['(', ')']])

    def _get_words_phrases_and_wildcards(self, string):
        if not len(string):
            return []

        string = self._strip_unmatched_characters(string)

        token = QuotedString('"', unquoteResults=False) | Word(printables)
        parser = ZeroOrMore(token)

        unique_non_keyword_tokens = list(
            set([t for t in list(parser.parseString(string)) if t.lower() not in ['and', 'not', 'or']])
        )

        words_phrases_and_wildcards = []
        for token in unique_non_keyword_tokens:
            if '"' in token:
                words_phrases_and_wildcards.append(token[1:-1])
            else:
                token = self._strip_reserved_characters(token).strip()
                if len(token):
                    words_phrases_and_wildcards.append(token)

        return words_phrases_and_wildcards

    def _pre_process_query(self, query):
        query = self._strip_unmatched_characters(query)

        open_parens = Word('(')
        closed_parens = Word(')')
        term = Word(printables)
        quoted_term = QuotedString('"', unquoteResults=False)
        quoted_term_with_parens = Optional(open_parens) + quoted_term + Optional(closed_parens)
        quoted_term_with_parens.setParseAction(''.join)
        operand = quoted_term_with_parens | term
        query_parser = ZeroOrMore(operand)

        unstackable_logical_ops = ['and', 'or']
        new_query = []
        tokens = list(query_parser.parseString(query))
        for i, curr in enumerate(tokens):
            if i == len(tokens) - 1:
                new_query += [curr]
                continue

            _next = tokens[i + 1]

            if curr in ['(', ')']:
                new_query += [curr]
            elif curr.lower() == 'not':
                if _next.lower() in unstackable_logical_ops:
                    raise ServerException(
                        title='Content Search Error',
                        message='Your query appears malformed. A logical operator (AND/OR) was '
                                + 'encountered immediately following a NOT operator.',
                        code=400,
                    )
                new_query += [curr]
            elif curr.lower() in unstackable_logical_ops:
                if _next.lower() in unstackable_logical_ops:
                    raise ServerException(
                        title='Content Search Error',
                        message='Your query appears malformed. Two logical operators (AND/OR) '
                                + 'were encountered in succession.',
                        code=400,
                    )
                new_query += [curr]
            elif _next.lower() not in unstackable_logical_ops + [')']:
                new_query += [curr, 'and']
            else:
                new_query += [curr]
        return ' '.join(new_query)

    def _map_field(self, field: str) -> str:
        field_map = {
            'description': 'description_txt',
            'filename': 'filename_txt',
            'data.content': 'data_content_txt',
            'file_path.tree': 'file_path_ss',
            'mime_type': 'mime_type_s',
            'project_id': 'project_id_i',
            'public': 'public_b',
        }
        return field_map.get(field, field.replace('.', '_'))

    def _format_value(self, value):
        if isinstance(value, bool):
            return self._normalize_bool(value)
        if isinstance(value, (int, float)):
            return str(value)
        value = str(value).replace('"', '\\"')
        return f'"{value}"'

    def _convert_filter_clause(self, clause: dict) -> str:
        if 'term' in clause:
            field, value = next(iter(clause['term'].items()))
            if field not in self.ALLOWED_FILTER_FIELDS:
                raise ServerException(title='Content Search Error', message='Unsupported search filter.', code=400)
            return f'{self._map_field(field)}:{self._format_value(value)}'
        if 'terms' in clause:
            field, values = next(iter(clause['terms'].items()))
            if field not in self.ALLOWED_FILTER_FIELDS:
                raise ServerException(title='Content Search Error', message='Unsupported search filter.', code=400)
            joined = ' OR '.join([f'{self._map_field(field)}:{self._format_value(v)}' for v in values])
            return f'({joined})'
        if 'bool' in clause:
            bool_clause = clause['bool']
            if 'must' in bool_clause:
                return '(' + ' AND '.join([self._convert_filter_clause(c) for c in bool_clause['must']]) + ')'
            if 'should' in bool_clause:
                return '(' + ' OR '.join([self._convert_filter_clause(c) for c in bool_clause['should']]) + ')'
            if 'must_not' in bool_clause:
                return 'NOT (' + ' AND '.join([self._convert_filter_clause(c) for c in bool_clause['must_not']]) + ')'
        raise ServerException(title='Content Search Error', message='Unsupported search filter.', code=400)

    def search(
        self,
        index_id: str,
        user_search_query: str,
        text_fields: List[str],
        text_field_boosts: Dict[str, int],
        return_fields: List[str],
        offset: int = 0,
        limit: int = 10,
        filter_=None,
        highlight=None,
    ):
        filter_ = filter_ or []
        highlight = highlight or {}

        if user_search_query == '':
            solr_query = '*:*'
            search_phrases = []
        else:
            solr_query = self._pre_process_query(user_search_query)
            search_phrases = self._get_words_phrases_and_wildcards(user_search_query)

        qf = ' '.join([f'{self._map_field(field)}^{text_field_boosts.get(field, 1)}' for field in text_fields])
        fq = [self._convert_filter_clause(clause) for clause in filter_]
        params = {
            'defType': 'edismax',
            'q': solr_query or '*:*',
            'qf': qf,
            'start': offset,
            'rows': limit,
            'wt': 'json',
            'hl': 'true',
            'hl.fl': self._map_field('data.content'),
            'hl.fragsize': highlight.get('fragment_size', 100),
            'hl.snippets': highlight.get('number_of_fragments', 100),
            'hl.simple.pre': (highlight.get('pre_tags') or ['@@@@$'])[0],
            'hl.simple.post': (highlight.get('post_tags') or ['@@@@/$'])[0],
            'fl': 'id,id_i,score',
        }

        try:
            request_params = list(params.items())
            request_params.extend([('fq', clause) for clause in fq])
            response = self._request('get', self._select_url(index_id), params=request_params)
            response.raise_for_status()
            solr_response = response.json()
        except Exception as e:
            raise ServerException(
                title='Content Search Error',
                message='Something went wrong during content search. Please simplify your query '
                        + '(e.g. remove terms, filters, flags, etc.) and try again.',
                code=400,
            ) from e

        docs = solr_response.get('response', {}).get('docs', [])
        highlighting = solr_response.get('highlighting', {})
        hits = []
        for doc in docs:
            doc_id = doc.get('id')
            file_id = doc.get('id_i')
            hit = {
                '_id': doc_id,
                '_score': doc.get('score', 0.0),
                'fields': {'id': [file_id] if file_id is not None else []},
            }
            snippets = highlighting.get(doc_id, {}).get('data_content_txt')
            if snippets:
                hit['highlight'] = {'data.content': snippets}
            hits.append(hit)

        return {
            'hits': {
                'total': solr_response.get('response', {}).get('numFound', 0),
                'hits': hits,
            }
        }, search_phrases
    # End search methods
