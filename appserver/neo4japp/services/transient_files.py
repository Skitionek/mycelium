"""
Short-lived storage for file content that is processed without being saved.

Files in a user's local folder are never uploaded into a project, but annotating a PDF
needs the PDF parser to pull it over HTTP, the same way it pulls stored files. The content
is therefore kept in Redis under an unguessable token for as long as that takes, and served
from a URL containing the token. Entries expire on their own if they are not discarded.
"""
import re
import secrets
from typing import Optional

from neo4japp.services.rcache import redis_server

TRANSIENT_FILE_TTL = 10 * 60
_KEY_PREFIX = 'transient_file:'
_TOKEN_RE = re.compile(r'^[A-Za-z0-9_-]{32,128}$')


def _key(token: str) -> str:
    return f'{_KEY_PREFIX}{token}'


def is_valid_token(token: str) -> bool:
    return bool(_TOKEN_RE.match(token or ''))


def stash_transient_file(content: bytes, ttl: int = TRANSIENT_FILE_TTL) -> str:
    """Keep content for a while and return the token it can be read back with."""
    token = secrets.token_urlsafe(32)
    redis_server.set(_key(token), content, ex=ttl)
    return token


def read_transient_file(token: str) -> Optional[bytes]:
    if not is_valid_token(token):
        return None
    return redis_server.get(_key(token))


def discard_transient_file(token: str) -> None:
    if is_valid_token(token):
        redis_server.delete(_key(token))
