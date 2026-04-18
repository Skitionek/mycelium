"""Unit tests for the storage abstraction layer.

These tests use mocks/stubs and do not require a running database or any
cloud credentials.
"""

from __future__ import annotations

import io
import sys
from datetime import datetime
from typing import BinaryIO, List, Optional
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Stub out heavy app-level modules that are unavailable in the unit-test
# environment (no full Flask app stack is set up here).  These stubs must be
# injected into sys.modules **before** the PostgresAdapter import chain fires.
# ---------------------------------------------------------------------------
for _stub_mod in [
    "elasticsearch",
    "timeflake",
    "sqlalchemy_searchable",
    "sqlalchemy_utils",
    "sqlalchemy_utils.types",
    "flask_sqlalchemy",
    "flask_migrate",
    "flask_caching",
    "flask_cors",
    "flask_httpauth",
    "flask_marshmallow",
    "flask_apispec",
    "marshmallow",
    "marshmallow.fields",
    "marshmallow_sqlalchemy",
    "marshmallow_sqlalchemy.convert",
    "marshmallow_dataclass",
    "marshmallow_enum",
    "lmdb",
    "neo4j",
    "redis",
    "sendgrid",
    # Full neo4japp modules to short-circuit the deep import chain
    "neo4japp.database",
    "neo4japp.models",
    "neo4japp.models.common",
    "neo4japp.models.files",
    "neo4japp.models.auth",
    "neo4japp.models.projects",
    "neo4japp.utils",
    "neo4japp.utils.sqlalchemy",
    "neo4japp.util",
    "neo4japp.exceptions",
    "neo4japp.constants",
]:
    if _stub_mod not in sys.modules:
        sys.modules[_stub_mod] = MagicMock()  # type: ignore[assignment]

from neo4japp.storage.interface import (
    FileStat,
    IStorageProvider,
    NotSupportedError,
    Revision,
    StorageCapabilities,
)
from neo4japp.storage.adapters.azure_adls import (
    _mode_to_posix_str,
    _posix_str_to_mode,
)


# ---------------------------------------------------------------------------
# Helpers / minimal concrete provider for interface tests
# ---------------------------------------------------------------------------


class _FullProvider(IStorageProvider):
    """Minimal concrete implementation used to verify the ABC contract."""

    _CAPS = StorageCapabilities(supports_acl=True, supports_versioning=True)

    @property
    def capabilities(self) -> StorageCapabilities:
        return self._CAPS

    def stat(self, path: str) -> FileStat:
        return FileStat(path=path)

    def chmod(self, path: str, mode: int) -> None:
        pass  # supported

    def chown(self, path: str, uid: str, gid: str) -> None:
        pass  # supported

    def list_revisions(self, path: str) -> List[Revision]:
        return []

    def get_revision_stream(self, path: str, rev_id: str) -> BinaryIO:
        return io.BytesIO(b"")

    def restore_revision(self, path: str, rev_id: str) -> None:
        pass

    def open_read(self, path: str) -> BinaryIO:
        return io.BytesIO(b"hello")

    def open_write(self, path: str, stream: BinaryIO, size: Optional[int] = None) -> None:
        pass


class _NoAclProvider(_FullProvider):
    """Provider that declares no ACL support."""

    _CAPS = StorageCapabilities(supports_acl=False, supports_versioning=True)


# ---------------------------------------------------------------------------
# Interface / base-class tests
# ---------------------------------------------------------------------------


class TestIStorageProviderAclGuard:
    """The base-class chmod/chown must raise NotSupportedError when
    supports_acl is False and the subclass has not overridden the methods."""

    def test_chmod_raises_when_acl_not_supported(self):
        provider = _NoAclProvider()
        # _NoAclProvider inherits the base chmod; base raises NotSupportedError
        # because capabilities.supports_acl is False.
        # BUT _NoAclProvider overrides chmod with a pass — so to test the
        # base-class guard we instantiate IStorageProvider indirectly via a
        # provider that does NOT override chmod.
        class _BareNoAcl(IStorageProvider):
            _CAPS = StorageCapabilities(supports_acl=False, supports_versioning=False)

            @property
            def capabilities(self):
                return self._CAPS

            def stat(self, path):
                return FileStat(path=path)

            def list_revisions(self, path):
                return []

            def get_revision_stream(self, path, rev_id):
                return io.BytesIO(b"")

            def restore_revision(self, path, rev_id):
                pass

            def open_read(self, path):
                return io.BytesIO(b"")

            def open_write(self, path, stream, size=None):
                pass

        p = _BareNoAcl()
        with pytest.raises(NotSupportedError) as exc_info:
            p.chmod("/some/path", 0o644)
        assert "chmod" in str(exc_info.value)
        assert exc_info.value.capability == "chmod"

    def test_chown_raises_when_acl_not_supported(self):
        class _BareNoAcl(IStorageProvider):
            _CAPS = StorageCapabilities(supports_acl=False, supports_versioning=False)

            @property
            def capabilities(self):
                return self._CAPS

            def stat(self, path):
                return FileStat(path=path)

            def list_revisions(self, path):
                return []

            def get_revision_stream(self, path, rev_id):
                return io.BytesIO(b"")

            def restore_revision(self, path, rev_id):
                pass

            def open_read(self, path):
                return io.BytesIO(b"")

            def open_write(self, path, stream, size=None):
                pass

        p = _BareNoAcl()
        with pytest.raises(NotSupportedError) as exc_info:
            p.chown("/some/path", "alice", "staff")
        assert "chown" in str(exc_info.value)

    def test_acl_methods_work_when_supported(self):
        p = _FullProvider()
        # Should not raise
        p.chmod("/path", 0o755)
        p.chown("/path", "alice", "staff")


# ---------------------------------------------------------------------------
# Data model tests
# ---------------------------------------------------------------------------


class TestStorageCapabilities:
    def test_defaults(self):
        caps = StorageCapabilities()
        assert caps.supports_acl is False
        assert caps.supports_versioning is False

    def test_custom_values(self):
        caps = StorageCapabilities(supports_acl=True, supports_versioning=True)
        assert caps.supports_acl is True
        assert caps.supports_versioning is True


class TestFileStat:
    def test_default_mode(self):
        stat = FileStat(path="/foo/bar")
        assert stat.mode == 0o644

    def test_custom_fields(self):
        now = datetime(2024, 1, 1, 12, 0, 0)
        stat = FileStat(
            path="/foo/bar",
            size=1024,
            content_type="application/pdf",
            created_at=now,
            modified_at=now,
            mode=0o755,
            owner="alice",
            group="staff",
        )
        assert stat.size == 1024
        assert stat.content_type == "application/pdf"
        assert stat.mode == 0o755
        assert stat.owner == "alice"
        assert stat.group == "staff"


class TestRevision:
    def test_required_fields(self):
        rev = Revision(rev_id="abc123", path="/foo")
        assert rev.rev_id == "abc123"
        assert rev.path == "/foo"
        assert rev.message is None
        assert rev.extra == {}

    def test_full_fields(self):
        now = datetime(2024, 6, 15)
        rev = Revision(
            rev_id="v1",
            path="/doc.pdf",
            created_at=now,
            author="bob@example.com",
            message="initial upload",
            size=512,
            extra={"tag": "release"},
        )
        assert rev.author == "bob@example.com"
        assert rev.size == 512
        assert rev.extra["tag"] == "release"


class TestNotSupportedError:
    def test_message_contains_capability(self):
        exc = NotSupportedError("chmod", "PostgresAdapter")
        assert "chmod" in str(exc)
        assert "PostgresAdapter" in str(exc)
        assert exc.capability == "chmod"
        assert exc.adapter == "PostgresAdapter"

    def test_no_adapter_name(self):
        exc = NotSupportedError("chown")
        assert "chown" in str(exc)
        assert exc.adapter == ""


# ---------------------------------------------------------------------------
# POSIX mode helper tests (AzureDataLakeAdapter internals)
# ---------------------------------------------------------------------------


class TestPosixModeHelpers:
    def test_rwxrwxrwx(self):
        assert _posix_str_to_mode("rwxrwxrwx") == 0o777

    def test_rw_r__r__(self):
        assert _posix_str_to_mode("rw-r--r--") == 0o644

    def test_rwxr_xr_x(self):
        assert _posix_str_to_mode("rwxr-xr-x") == 0o755

    def test_empty_string_returns_default(self):
        assert _posix_str_to_mode("") == 0o644

    def test_short_string_returns_default(self):
        assert _posix_str_to_mode("rw") == 0o644

    def test_mode_to_posix_str_644(self):
        assert _mode_to_posix_str(0o644) == "rw-r--r--"

    def test_mode_to_posix_str_755(self):
        assert _mode_to_posix_str(0o755) == "rwxr-xr-x"

    def test_mode_to_posix_str_777(self):
        assert _mode_to_posix_str(0o777) == "rwxrwxrwx"

    def test_roundtrip(self):
        for mode in (0o644, 0o755, 0o700, 0o600, 0o400):
            assert _posix_str_to_mode(_mode_to_posix_str(mode)) == mode


# ---------------------------------------------------------------------------
# GoogleDriveAdapter role-mapping tests
# ---------------------------------------------------------------------------


class TestGoogleDriveRoleMapping:
    def test_mode_to_role_writer(self):
        from neo4japp.storage.adapters.google_drive import _mode_to_role
        assert _mode_to_role(0o644) == "writer"
        assert _mode_to_role(0o600) == "writer"

    def test_mode_to_role_commenter(self):
        from neo4japp.storage.adapters.google_drive import _mode_to_role
        assert _mode_to_role(0o400) == "commenter"
        assert _mode_to_role(0o444) == "commenter"

    def test_mode_to_role_reader(self):
        from neo4japp.storage.adapters.google_drive import _mode_to_role
        assert _mode_to_role(0o000) == "reader"

    def test_role_to_mode(self):
        from neo4japp.storage.adapters.google_drive import _role_to_mode
        assert _role_to_mode("owner") == 0o700
        assert _role_to_mode("writer") == 0o600
        assert _role_to_mode("reader") == 0o400
        assert _role_to_mode("unknown_role") == 0o400  # fallback


# ---------------------------------------------------------------------------
# PostgresAdapter unit tests (all DB calls are mocked)
# ---------------------------------------------------------------------------


class TestPostgresAdapterCapabilities:
    def test_capabilities(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        assert adapter.capabilities.supports_acl is False
        assert adapter.capabilities.supports_versioning is True

    def test_chmod_raises(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        with pytest.raises(NotSupportedError) as exc_info:
            adapter.chmod("/some/hash", 0o755)
        assert exc_info.value.capability == "chmod"

    def test_chown_raises(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        with pytest.raises(NotSupportedError):
            adapter.chown("/some/hash", "uid", "gid")


class TestPostgresAdapterStat:
    def _make_file(self, hash_id="abc", mime="text/plain", size=42):
        f = MagicMock()
        f.hash_id = hash_id
        f.mime_type = mime
        f.creation_date = datetime(2024, 1, 1)
        f.modified_date = datetime(2024, 6, 1)
        f.user_id = 7
        f.content = MagicMock()
        f.content.raw_file = b"x" * size
        return f

    def test_stat_returns_filestat(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file()

        with patch.object(adapter, "_get_file", return_value=mock_file):
            result = adapter.stat("abc")

        assert isinstance(result, FileStat)
        assert result.path == "abc"
        assert result.size == 42
        assert result.content_type == "text/plain"
        assert result.mode == 0o644  # default — no ACL support
        assert result.owner == "7"

    def test_stat_raises_for_missing_file(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        with patch.object(adapter, "_get_file", side_effect=FileNotFoundError("not found")):
            with pytest.raises(FileNotFoundError):
                adapter.stat("missing")


class TestPostgresAdapterRevisions:
    def _make_version(self, hash_id, content_bytes=b"data", message=None):
        fv = MagicMock()
        fv.hash_id = hash_id
        fv.creation_date = datetime(2024, 3, 1)
        fv.message = message
        fv.user = MagicMock()
        fv.user.username = "alice"
        fv.user_id = 1
        fv.content = MagicMock()
        fv.content.raw_file = content_bytes
        return fv

    def test_list_revisions_returns_revisions(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        mock_file = MagicMock()
        mock_file.id = 1

        fv1 = self._make_version("v1", b"old")
        fv2 = self._make_version("v2", b"older", message="initial")

        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db, \
             patch("neo4japp.storage.adapters.postgres.joinedload") as mock_joinedload:
            mock_joinedload.return_value = MagicMock()
            mock_query = MagicMock()
            mock_db.session.query.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.order_by.return_value = mock_query
            mock_query.all.return_value = [fv1, fv2]

            revisions = adapter.list_revisions("abc")

        assert len(revisions) == 2
        assert revisions[0].rev_id == "v1"
        assert revisions[1].rev_id == "v2"
        assert revisions[1].message == "initial"

    def test_get_revision_stream_returns_bytes(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        mock_fv = MagicMock()
        mock_fv.content = MagicMock()
        mock_fv.content.raw_file = b"revision content"

        with patch.object(adapter, "_get_file_version", return_value=mock_fv):
            stream = adapter.get_revision_stream("abc", "v1")

        assert stream.read() == b"revision content"

    def test_open_read_returns_stream(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        mock_file = MagicMock()
        mock_file.content = MagicMock()
        mock_file.content.raw_file = b"file content"

        with patch.object(adapter, "_get_file", return_value=mock_file):
            stream = adapter.open_read("abc")

        assert stream.read() == b"file content"
