import urllib.request
from contextlib import contextmanager
from urllib.error import URLError, HTTPError

import httpretty
import pytest

from neo4japp.utils.network import URLFixerHandler, DirectDownloadDetectorHandler, read_url, \
    ControlledConnectionMixin, ContentTooLongError


@contextmanager
def monkey_patch_controlled_conn():
    prev_is_ip_allowed = ControlledConnectionMixin.is_ip_allowed
    prev_resolve = ControlledConnectionMixin.resolve
    ControlledConnectionMixin.is_ip_allowed = lambda self, ip: True
    ControlledConnectionMixin.resolve = lambda self, host: host
    yield
    ControlledConnectionMixin.is_ip_allowed = prev_is_ip_allowed
    ControlledConnectionMixin.resolve = prev_resolve


@httpretty.activate(allow_net_connect=False)
def test_read_url():
    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com', body='yo 🤙')
        assert 'yo 🤙' == read_url('http://example.com', max_length=1024 * 8).getvalue().decode(
            'utf-8')


@httpretty.activate(allow_net_connect=False)
def test_read_url_has_custom_user_agent():
    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com', body='hello')
        read_url(urllib.request.Request('http://example.com', headers={
            'User-Agent': 'some test',
        }), max_length=1000)
        assert 'some test' == httpretty.last_request().headers['User-Agent']


@pytest.mark.parametrize('url', [
    'file://etc/passwd',
    'ftp://example.com',
    'data:text/plain;charset=utf-8;base64,eW8=',
], ids=str)
def test_read_url_fails_on_dangerous_schemes(url):
    with pytest.raises(URLError):
        read_url(url, max_length=1000)


@httpretty.activate(allow_net_connect=False)
def test_read_url_enforces_read_length():
    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com', body=('hello' * 1000))
        with pytest.raises(ContentTooLongError):
            read_url('http://example.com', max_length=1000)


@httpretty.activate(allow_net_connect=False)
def test_read_url_ignores_malicious_content_length_header():
    def generate_response(request, uri, response_headers):
        response_headers['Content-Length'] = 1
        return [200, response_headers, 'hello' * 1000]

    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com', body=generate_response)
        assert b'h' == read_url('http://example.com', max_length=1000).getvalue()


@httpretty.activate(allow_net_connect=False)
def test_read_url_ignores_wrong_content_length_header():
    def generate_response(request, uri, response_headers):
        response_headers['Content-Length'] = 10
        return [200, response_headers, 'hello']

    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com', body=generate_response)
        assert b'hello' == read_url('http://example.com', max_length=1000).getvalue()


@pytest.mark.parametrize('status_code', [301, 302, 303, 307], ids=str)
@httpretty.activate(allow_net_connect=False)
def test_read_url_redirect_support(status_code):
    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com/redirect', forcing_headers={
            'Location': 'http://example.com'
        }, status=status_code)
        httpretty.register_uri(httpretty.GET, 'http://example.com', body='yo 🤙')
        assert 'yo 🤙' == \
               read_url('http://example.com/redirect', max_length=1024 * 8).getvalue().decode(
                   'utf-8')


@httpretty.activate(allow_net_connect=False)
def test_read_url_has_redirect_limit():
    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com/redirect', forcing_headers={
            'Location': 'http://example.com/redirect'
        }, status=302)
        with pytest.raises(HTTPError):
            read_url('http://example.com/redirect', max_length=1024 * 8)


@httpretty.activate(allow_net_connect=False)
def test_read_url_cookie_support():
    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com/redirect', forcing_headers={
            'Location': 'http://example.com',
            'Set-Cookie': 'name=joe'
        }, status=302)
        httpretty.register_uri(httpretty.GET, 'http://example.com', body='yo 🤙')
        assert 'yo 🤙' == \
               read_url('http://example.com/redirect', max_length=1024 * 8).getvalue().decode(
                   'utf-8')
        assert 'name=joe' == httpretty.last_request().headers['Cookie']


@pytest.mark.parametrize('url', [
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://192.168.1.1',
], ids=str)
def test_read_url_blocks_local_ips(url):
    with pytest.raises(URLError):
        read_url(url, max_length=1024 * 8)


@httpretty.activate(allow_net_connect=False)
def test_read_url_guards_against_dns_pinning():
    prev_resolve = ControlledConnectionMixin.resolve
    try:
        ControlledConnectionMixin.resolve = lambda self, host: '127.0.0.1'
        with pytest.raises(URLError):
            read_url('http://example.com', max_length=1024 * 8)
    finally:
        ControlledConnectionMixin.resolve = prev_resolve


@httpretty.activate(allow_net_connect=False)
def test_read_url_guards_against_dns_rebinding():
    class RebindingResolver:
        index = 0

        def __call__(self, *args, **kwargs):
            self.index += 1
            if self.index == 1:
                return '11.11.11.11'
            elif self.index == 2:
                return '127.0.0.1'
            else:
                raise RuntimeError('third case is not supposed to happen')

    prev_resolve = ControlledConnectionMixin.resolve
    try:
        resolver = RebindingResolver()
        ControlledConnectionMixin.resolve = resolver
        httpretty.register_uri(httpretty.GET, 'http://11.11.11.11', forcing_headers={
            'Location': 'http://example.com'
        }, status=302)
        with pytest.raises(URLError):
            read_url('http://example.com', max_length=1024 * 8)
        assert 2 == resolver.index
    finally:
        ControlledConnectionMixin.resolve = prev_resolve


@pytest.mark.parametrize(
    'url_pair', [
        # Basic tests
        ('http://www.example.com//a-simple/url//test',
         'http://www.example.com//a-simple/url//test'),
        ('http://www.example.com//a-simple/url/test\r\n\r\nContent-Type: application/json',
         'http://www.example.com//a-simple/url/test%0D%0A%0D%0AContent-Type%3A%20application/json'),
        ('https://www.example.com//a-simple/url//test',
         'https://www.example.com//a-simple/url//test'),
        ('https://user:pass@example.com:4000//test/test',
         'https://user:pass@example.com:4000//test/test'),
        ('ftp://test', 'ftp://test'),
        ('mailto:test@example.com?body=hi', 'mailto:test%40example.com?body=hi'),
        ('http://test@www.example.com:1000', 'http://test@www.example.com:1000'),

        # The Python std lib function does URL canonicalization
        # It'd be preferable if it didn't, but it does
        ('https://@example.com/test.pdf?#', 'https://@example.com/test.pdf'),
        ('https://@example.com/test.pdf?a#', 'https://@example.com/test.pdf?a'),
        ('https://@example.com/test.pdf?a#b', 'https://@example.com/test.pdf?a#b'),
        ('https://@example.com/test.pdf?#b', 'https://@example.com/test.pdf#b'),

        # Domain punycode
        ('https://💩.com', 'https://xn--ls8h.com'),

        # Try weird stuff
        ('https://🤙@example.com', 'https://%F0%9F%A4%99@example.com'),
        ('https://🤙@example.com/lets test 🤙.pdf',
         'https://%F0%9F%A4%99@example.com/lets%20test%20%F0%9F%A4%99.pdf'),
        ('https://www.example.com/the(file)-here$.pdf',
         'https://www.example.com/the%28file%29-here%24.pdf'),
        ('https://example.com/test_parameters.pdf?emoji=🤙',
         'https://example.com/test_parameters.pdf?emoji=%F0%9F%A4%99'),
        ('https://example.com/test_parameters.pdf#emoji=🤙',
         'https://example.com/test_parameters.pdf#emoji%3D%F0%9F%A4%99'),

        # Query characters that carry meaning are kept as they are
        ('https://example.com/search?q=a+b', 'https://example.com/search?q=a+b'),
        ('https://example.com/a?x=1;y=2,3', 'https://example.com/a?x=1;y=2,3'),
        ('https://example.com/a?next=http://b.example/c?d',
         'https://example.com/a?next=http://b.example/c?d'),
        ('https://example.com/a?q=a b', 'https://example.com/a?q=a%20b'),

        # IPv6 literals keep their brackets
        ('http://[2001:db8::1]:8080/p', 'http://[2001:db8::1]:8080/p'),
        ('http://[::1]/p', 'http://[::1]/p'),
    ],
    ids=lambda x: x[0],
)
def test_url_fixer_handler(url_pair):
    assert URLFixerHandler.fix_url(url_pair[0]) == url_pair[1]
    # Testing to make should that double encoding should not encode further
    assert URLFixerHandler.fix_url(url_pair[1]) == url_pair[1]


@pytest.mark.parametrize(
    'url_pair', [
        ('https://www.example.com//a-simple/url//test',
         'https://www.example.com//a-simple/url//test'),
        # wiley.com
        ('https://onlinelibrary.wiley.com/doi/epdf/10.1111/pce.13681',
         'https://onlinelibrary.wiley.com/doi/pdfdirect/10.1111/pce.13681?download=true')
    ],
    ids=lambda x: f'{x[0]} -> {x[1]}' if x[0] != x[1] else x[0],
)
def test_direct_download_handler(url_pair):
    assert DirectDownloadDetectorHandler.rewrite_url(url_pair[0]) == url_pair[1]
    # Testing to make should that double rewriting should not rewrite further
    assert DirectDownloadDetectorHandler.rewrite_url(url_pair[1]) == url_pair[1]


@pytest.mark.parametrize('port, allowed', [
    (80, True), (443, True), (8080, True), (20000, True),
    (79, False), (20001, False), (21, False), (22, False), (25, False), (587, False),
], ids=str)
def test_controlled_connection_port_policy(port, allowed):
    assert ControlledConnectionMixin().is_port_allowed(port) is allowed


@pytest.mark.parametrize('ip, allowed', [
    ('8.8.8.8', True),
    ('10.0.0.1', False),
    ('172.16.0.1', False),
    ('169.254.169.254', False),  # cloud metadata endpoint
    ('100.64.0.1', False),
    ('0.0.0.0', False),
    ('224.0.0.1', False),
], ids=str)
def test_controlled_connection_ip_policy(ip, allowed):
    assert ControlledConnectionMixin().is_ip_allowed(ip) is allowed


@httpretty.activate(allow_net_connect=False)
def test_read_url_blocks_a_disallowed_port():
    with monkey_patch_controlled_conn():
        with pytest.raises(URLError):
            read_url('http://example.com:22', max_length=1000)


@httpretty.activate(allow_net_connect=False)
def test_read_url_accepts_content_exactly_at_the_limit():
    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com', body='x' * 1000)
        assert len(read_url('http://example.com', max_length=1000).getvalue()) == 1000


@httpretty.activate(allow_net_connect=False)
def test_read_url_rejects_a_declared_content_length_over_the_limit():
    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com', body='x' * 2000)
        with pytest.raises(ContentTooLongError, match='Content-Length'):
            read_url('http://example.com', max_length=1000)


@httpretty.activate(allow_net_connect=False)
def test_read_url_writes_into_a_given_buffer():
    from io import BytesIO

    with monkey_patch_controlled_conn():
        httpretty.register_uri(httpretty.GET, 'http://example.com', body='hello')
        buffer = BytesIO()
        assert read_url('http://example.com', max_length=1000, buffer=buffer) is buffer
        assert buffer.getvalue() == b'hello'


@httpretty.activate(allow_net_connect=False)
def test_read_url_rewrites_to_direct_downloads_only_when_asked():
    with monkey_patch_controlled_conn():
        httpretty.register_uri(
            httpretty.GET, 'https://onlinelibrary.wiley.com/doi/epdf/10.1/x', body='viewer')
        httpretty.register_uri(
            httpretty.GET, 'https://onlinelibrary.wiley.com/doi/pdfdirect/10.1/x', body='pdf')

        url = 'https://onlinelibrary.wiley.com/doi/epdf/10.1/x'
        assert read_url(url, max_length=1000).getvalue() == b'viewer'
        assert read_url(url, max_length=1000, prefer_direct_downloads=True).getvalue() == b'pdf'
