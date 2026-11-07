"""DOI detection in uploaded PDFs and DOI links in exported maps.

doi.org is replaced by a fake that knows a fixed set of DOIs, answering 302
for those, as doi.org does, and 404 for anything else.
"""
from types import SimpleNamespace

import pytest

from neo4japp.services.file_types import providers
from neo4japp.services.file_types.providers import (
    _search_doi_in,
    get_link_icon_type,
    is_valid_doi,
)

KNOWN_DOIS = {'10.1111/pce.13681', '10.1038/nature12373', '10.1016/j.cell.2020.01.001'}


@pytest.fixture
def doi_org(monkeypatch):
    """Answer like doi.org; return the recorded requests."""
    requests_made = []

    def get(url, **kwargs):
        requests_made.append(SimpleNamespace(url=url, **kwargs))
        known = url.partition('doi.org/')[2] in KNOWN_DOIS
        return SimpleNamespace(status_code=302 if known else 404)

    monkeypatch.setattr(providers.requests, 'get', get)
    return requests_made


@pytest.mark.parametrize('text, doi', [
    (b'doi: 10.1111/pce.13681', 'https://doi.org/10.1111/pce.13681'),
    (b'See https://doi.org/10.1038/nature12373.', 'https://doi.org/10.1038/nature12373'),
    (b'https://dx.doi.org/10.1038/nature12373)', 'https://doi.org/10.1038/nature12373'),
    (b'DOI:10.1016/j.cell.2020.01.001, published',
     'https://doi.org/10.1016/j.cell.2020.01.001'),
    (b'doi: 10.1111/pce.13681\nReceived 2020', 'https://doi.org/10.1111/pce.13681'),
], ids=lambda value: value.decode() if isinstance(value, bytes) else '')
def test_finds_the_doi_in_text(doi_org, text, doi):
    assert _search_doi_in(text) == doi


def test_finds_nothing_without_a_doi(doi_org):
    assert _search_doi_in(b'no identifier in this text') is None
    assert doi_org == []


def test_finds_nothing_when_no_candidate_resolves(doi_org):
    assert _search_doi_in(b'doi: 10.1234/not.registered') is None


def test_lookups_are_bounded_in_time(doi_org):
    """A doi.org that never answers must not hold an upload forever."""
    _search_doi_in(b'doi: 10.1234/not.registered (accessed 2020)')

    assert doi_org
    for request in doi_org:
        assert request.timeout


@pytest.mark.parametrize('url', [
    'https://doi.org/10.1111/pce.13681',
    'http://doi.org/10.1111/pce.13681',
    'https://dx.doi.org/10.1111/pce.13681',
])
def test_accepts_a_registered_doi(doi_org, url):
    assert is_valid_doi(url)


def test_rejects_an_unregistered_doi(doi_org):
    assert not is_valid_doi('https://doi.org/10.1234/not.registered')


def test_asks_doi_org_over_https(doi_org):
    """Over plain HTTP doi.org redirects to HTTPS for any DOI, registered or not."""
    assert not is_valid_doi('http://doi.org/10.1234/not.registered')

    assert doi_org[0].url == 'https://doi.org/10.1234/not.registered'


def test_does_not_follow_doi_redirects(doi_org):
    """doi.org answers 302 for a registered DOI; where it points is not ours to fetch."""
    is_valid_doi('https://doi.org/10.1111/pce.13681')

    assert doi_org[0].allow_redirects is False


@pytest.mark.parametrize('url', [
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:5000/admin',
    'https://doi.org.attacker.example/10.1111/x',
    'https://attacker.example/?https://doi.org/10.1111/x',
    'file:///etc/passwd',
    '',
    None,
])
def test_never_requests_anything_but_doi_org(doi_org, url):
    """Map sources are user content; their URLs must not reach the network."""
    assert not is_valid_doi(url)
    assert doi_org == []


def map_link_node(sources=None, hyperlinks=None):
    data = {}
    if sources is not None:
        data['sources'] = sources
    if hyperlinks is not None:
        data['hyperlinks'] = hyperlinks
    return {'data': data}


def test_document_link_points_at_its_doi(doi_org):
    node = map_link_node(sources=[
        {'domain': 'paper.pdf', 'url': '/projects/p/files/abc#page=1'},
        {'domain': 'DOI', 'url': 'https://doi.org/10.1111/pce.13681'},
    ])

    assert get_link_icon_type(node) == ('document', 'https://doi.org/10.1111/pce.13681')


def test_document_link_without_doi_drops_the_internal_url(doi_org):
    node = map_link_node(sources=[
        {'domain': 'paper.pdf', 'url': '/projects/p/files/abc#page=1'},
    ])

    assert get_link_icon_type(node) == ('document', None)
    assert node['data']['sources'] == []


def test_document_hyperlink_on_a_node_without_sources(doi_org):
    node = map_link_node(hyperlinks=[
        {'domain': 'paper.pdf', 'url': '/projects/p/files/abc'},
    ])

    assert get_link_icon_type(node) == ('document', None)
    assert node['data']['hyperlinks'] == []


def test_document_link_with_a_forged_doi_source_requests_nothing(doi_org):
    node = map_link_node(sources=[
        {'domain': 'paper.pdf', 'url': '/projects/p/files/abc'},
        {'domain': 'DOI', 'url': 'http://169.254.169.254/latest/meta-data/'},
    ])

    assert get_link_icon_type(node) == ('document', None)
    assert doi_org == []


@pytest.mark.parametrize('url, icon', [
    ('/projects/p/enrichment-table/abc', ('enrichment_table', '/projects/p/enrichment-table/abc')),
    ('/projects/p/sankey/abc', ('sankey', '/projects/p/sankey/abc')),
    ('/projects/p/bioc/abc', ('bioc', '/projects/p/bioc/abc')),
    ('/projects/COVID-19', ('project', '/projects/COVID-19')),
    ('mailto:someone@example.com', ('email', 'mailto:someone@example.com')),
    ('https://example.com', ('link', None)),
])
def test_link_icon_follows_the_link_kind(doi_org, url, icon):
    assert get_link_icon_type(map_link_node(sources=[{'domain': 'x', 'url': url}])) == icon
