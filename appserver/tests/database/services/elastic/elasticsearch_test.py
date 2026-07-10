import pytest

from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE


@pytest.fixture(scope='function')
def highlight():
    return {
        'fields': {
            'data.content': {},
        },
        'fragment_size': FRAGMENT_SIZE,
        'order': 'score',
        'pre_tags': ['@@@@$'],
        'post_tags': ['@@@@/$'],
        'number_of_fragments': 200,
    }


@pytest.fixture(scope='function')
def text_fields():
    return ['description', 'data.content', 'filename']


@pytest.fixture(scope='function')
def text_field_boosts():
    return {'description': 1, 'data.content': 1, 'filename': 3}


@pytest.fixture(scope='function')
def return_fields():
    return ['id']


@pytest.fixture(scope='function')
def public_filter():
    """A minimal valid filter that accepts public documents."""
    return [{'term': {'public': True}}]


def _add_doc(service, doc):
    """POST a document to Solr and commit immediately."""
    service._request(
        'post',
        service._update_url(FILE_INDEX_ID),
        params={'commit': 'true'},
        json={'add': {'doc': doc}},
        headers={'Content-Type': 'application/json'},
    ).raise_for_status()


@pytest.fixture(scope='function')
def pdf_document(search_index_service):
    _add_doc(search_index_service, {
        'id': 'test-hash-pdf-1',
        'id_i': 1,
        'filename_txt': 'test_pdf',
        'description_txt': 'mock pdf document for testing',
        'data_content_txt': 'BOLA3',
        'project_id_i': 1,
        'public_b': 'true',
        'mime_type_s': 'application/pdf',
    })


@pytest.fixture(scope='function')
def map_document(search_index_service):
    _add_doc(search_index_service, {
        'id': 'test-hash-map-2',
        'id_i': 2,
        'filename_txt': 'test_map',
        'description_txt': 'mock map document for testing elasticsearch',
        'data_content_txt': 'COVID',
        'project_id_i': 1,
        'public_b': 'true',
        'mime_type_s': 'vnd.mycelium.document/map',
    })


# ---------------------------------------------------------------------------
# Basic search integration tests
# ---------------------------------------------------------------------------

def test_should_not_get_results_from_empty_db(
    search_index_service,
    highlight,
    text_fields,
    text_field_boosts,
    return_fields,
):
    res, _ = search_index_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='BOLA3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=[],
        highlight=highlight,
        return_fields=return_fields,
    )
    assert len(res['hits']['hits']) == 0


def test_can_get_results_from_pdf(
    search_index_service,
    pdf_document,
    highlight,
    public_filter,
    text_fields,
    text_field_boosts,
    return_fields,
):
    res, _ = search_index_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='BOLA3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=public_filter,
        highlight=highlight,
        return_fields=return_fields,
    )
    assert len(res['hits']['hits']) > 0


def test_can_get_results_from_pdf_with_asterisk_wildcard_phrase(
    search_index_service,
    pdf_document,
    highlight,
    public_filter,
    text_fields,
    text_field_boosts,
    return_fields,
):
    res, _ = search_index_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='BO*A3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=public_filter,
        highlight=highlight,
        return_fields=return_fields,
    )
    assert len(res['hits']['hits']) > 0


def test_can_get_results_from_pdf_with_question_mark_wildcard_phrase(
    search_index_service,
    pdf_document,
    highlight,
    public_filter,
    text_fields,
    text_field_boosts,
    return_fields,
):
    res, _ = search_index_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='BO?A3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=public_filter,
        highlight=highlight,
        return_fields=return_fields,
    )
    assert len(res['hits']['hits']) > 0


def test_can_get_results_from_map(
    search_index_service,
    map_document,
    highlight,
    public_filter,
    text_fields,
    text_field_boosts,
    return_fields,
):
    res, _ = search_index_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='COVID',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=public_filter,
        highlight=highlight,
        return_fields=return_fields,
    )
    assert len(res['hits']['hits']) > 0


def test_can_get_results_from_map_with_wildcard_phrase(
    search_index_service,
    map_document,
    highlight,
    public_filter,
    text_fields,
    text_field_boosts,
    return_fields,
):
    res, _ = search_index_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='CO*ID',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=public_filter,
        highlight=highlight,
        return_fields=return_fields,
    )
    assert len(res['hits']['hits']) > 0


def test_can_get_results_with_quoted_phrase(
    search_index_service,
    map_document,
    highlight,
    public_filter,
    text_fields,
    text_field_boosts,
    return_fields,
):
    res, _ = search_index_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='"mock map document"',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=public_filter,
        highlight=highlight,
        return_fields=return_fields,
    )
    assert len(res['hits']['hits']) > 0


def test_using_wildcard_in_phrase_does_not_work(
    search_index_service,
    pdf_document,
    highlight,
    public_filter,
    text_fields,
    text_field_boosts,
    return_fields,
):
    res, _ = search_index_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='"BO*A3"',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=public_filter,
        highlight=highlight,
        return_fields=return_fields,
    )
    assert len(res['hits']['hits']) == 0


# ---------------------------------------------------------------------------
# Query pre-processing tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    'test, expected',
    [
        ('p q', 'p and q'),
        ('p AND q', 'p AND q'),
        ('p or q', 'p or q'),
        ('p q or r', 'p and q or r'),
        ('p or q r', 'p or q and r'),
        ('"p AND q"', '"p AND q"'),
        ('"p AND q" r', '"p AND q" and r'),
        ('"p AND q" AND r', '"p AND q" AND r'),
        ('"p AND q" or r', '"p AND q" or r'),
        ('r "p AND q" t', 'r and "p AND q" and t'),
        ('r "p AND q" m or n', 'r and "p AND q" and m or n'),
        ('("p AND q" r) (m or n)', '("p AND q" and r) and (m or n)'),
        ('(r AND "p AND q") (m or n)', '(r AND "p AND q") and (m or n)'),
        ('("p or q" or r) or (m n)', '("p or q" or r) or (m and n)'),
        ('(r or "p or q") or (m AND n)', '(r or "p or q") or (m AND n)'),
        ('(r "p AND q" m) or n', '(r and "p AND q" and m) or n'),
        (
            '(("p AND q" r s) or (t u v)) w',
            '(("p AND q" and r and s) or (t and u and v)) and w',
        ),
        ('p not q', 'p and not q'),
        ('p AND not q', 'p AND not q'),
        ('not p q', 'not p and q'),
        ('not p AND q', 'not p AND q'),
        ('p or not q', 'p or not q'),
        ('not p or q', 'not p or q'),
        ('"(p and q)"', '"(p and q)"'),
        ('"(p and q"', '"(p and q"'),
        ('"p and q)"', '"p and q)"'),
        ('"((p and q))"', '"((p and q))"'),
        ('"p and q))"', '"p and q))"'),
    ],
)
def test_pre_process_query(search_index_service, test, expected):
    assert search_index_service._pre_process_query(test) == expected


# ---------------------------------------------------------------------------
# String sanitisation helper tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    'test, expected',
    [
        ('"dog and cat"', '"dog and cat"'),
        ('"dog and" cat"', '"dog and" cat'),
        ('"dog " and cat"', '"dog " and cat'),
    ],
)
def test_strip_unmatched_quotations(search_index_service, test, expected):
    assert search_index_service._strip_unmatched_quotations(test) == expected


@pytest.mark.parametrize(
    'test, expected',
    [
        ('()', '()'),
        ('(())', '(())'),
        ('() ()', '() ()'),
        ('(()) ()', '(()) ()'),
        ('(', ''),
        ('(()', '()'),
        ('() (', '() '),
        ('(() ()', '() ()'),
        ('( ()', ' ()'),
        ('(()) (', '(()) '),
        (')(', ''),
        (')', ''),
        ('())', '()'),
        ('()) ()', '() ()'),
        (')))', ''),
        ('(((', ''),
        ('())))', '()'),
        ('((()', '()'),
    ],
)
def test_strip_unmatched_parens(search_index_service, test, expected):
    assert search_index_service._strip_unmatched_parens(test) == expected


@pytest.mark.parametrize(
    'test, expected',
    [
        ('"(p and q"', ['(p and q']),
        ('cat or not (dog AND mouse)', ['cat', 'dog', 'mouse']),
        ('(cat or "dog or mouse") "AND fish"', ['cat', 'dog or mouse', 'AND fish']),
        (
            'epinephrine benzene-1,2-diol;hydrochloride',
            ['epinephrine', 'benzene-1,2-diol;hydrochloride'],
        ),
        (
            '"epinephrine benzene-1,2-diol;hydrochloride"',
            ['epinephrine benzene-1,2-diol;hydrochloride'],
        ),
        (
            '"epinephrine benzene-1,2-diol;hydrochloride',
            ['epinephrine', 'benzene-1,2-diol;hydrochloride'],
        ),
        ('co*id benzene-1,2-diol;hydrochloride', ['co*id', 'benzene-1,2-diol;hydrochloride']),
    ],
)
def test_get_words_phrases_and_wildcards(search_index_service, test, expected):
    assert set(search_index_service._get_words_phrases_and_wildcards(test)) == set(expected)
