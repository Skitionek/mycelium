"""Unit tests for the storage abstraction layer.

These tests use mocks/stubs and do not require a running database or any
cloud credentials.
"""

from __future__ import annotations

import hashlib
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

from neo4japp.storage.interface import (  # noqa: E402
    FileStat,
    IStorageProvider,
    NotSupportedError,
    Revision,
    StorageCapabilities,
)
from neo4japp.storage.adapters.azure_adls import (  # noqa: E402
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
        assert adapter.capabilities.supports_acl is True
        assert adapter.capabilities.supports_versioning is True

    def test_chmod_does_not_raise(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = MagicMock()
        mock_file.public = False
        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.db"):
            adapter.chmod("/some/hash", 0o604)  # should not raise

    def test_chown_does_not_raise(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = MagicMock()
        mock_user = MagicMock()
        mock_user.id = 99
        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db:
            mock_query = MagicMock()
            mock_db.session.query.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.one_or_none.return_value = mock_user
            adapter.chown("/some/hash", "user-hash-id", "")  # should not raise


class TestPostgresAdapterAcl:
    def _make_file(self, public=False):
        f = MagicMock()
        f.public = public
        f.user_id = 7
        return f

    # chmod
    def test_chmod_sets_public_true_when_other_read_set(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file(public=False)
        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db:
            adapter.chmod("abc", 0o604)
        assert mock_file.public is True
        mock_db.session.flush.assert_called_once()

    def test_chmod_clears_public_when_other_read_absent(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file(public=True)
        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db:
            adapter.chmod("abc", 0o600)
        assert mock_file.public is False
        mock_db.session.flush.assert_called_once()

    def test_chmod_raises_when_file_missing(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        with patch.object(adapter, "_get_file", side_effect=FileNotFoundError("nope")):
            with pytest.raises(FileNotFoundError):
                adapter.chmod("missing", 0o644)

    # chown
    def test_chown_updates_user_id(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file()
        mock_user = MagicMock()
        mock_user.id = 42
        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db:
            mock_query = MagicMock()
            mock_db.session.query.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.one_or_none.return_value = mock_user
            adapter.chown("abc", "new-owner-hash", "")
        assert mock_file.user_id == 42
        mock_db.session.flush.assert_called_once()

    def test_chown_raises_when_user_missing(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file()
        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db:
            mock_query = MagicMock()
            mock_db.session.query.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.one_or_none.return_value = None
            with pytest.raises(FileNotFoundError):
                adapter.chown("abc", "nonexistent-hash", "")

    def test_chown_raises_when_file_missing(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        with patch.object(adapter, "_get_file", side_effect=FileNotFoundError("nope")):
            with pytest.raises(FileNotFoundError):
                adapter.chown("missing", "uid", "gid")

    # stat mode derivation
    def test_stat_mode_private_file(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file(public=False)
        mock_file.hash_id = "abc"
        mock_file.mime_type = "text/plain"
        mock_file.creation_date = mock_file.modified_date = None
        mock_file.content = None
        with patch.object(adapter, "_get_file", return_value=mock_file):
            result = adapter.stat("abc")
        assert result.mode == 0o600  # owner rw-, no world-read

    def test_stat_mode_public_file(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file(public=True)
        mock_file.hash_id = "abc"
        mock_file.mime_type = "text/plain"
        mock_file.creation_date = mock_file.modified_date = None
        mock_file.content = None
        with patch.object(adapter, "_get_file", return_value=mock_file):
            result = adapter.stat("abc")
        assert result.mode == 0o604  # owner rw- + other r--


class TestPostgresAdapterStat:
    def _make_file(self, hash_id="abc", mime="text/plain", size=42, public=False):
        f = MagicMock()
        f.hash_id = hash_id
        f.mime_type = mime
        f.creation_date = datetime(2024, 1, 1)
        f.modified_date = datetime(2024, 6, 1)
        f.user_id = 7
        f.public = public
        f.content = MagicMock()
        f.content.raw_file = b"x" * size
        f.content.checksum_sha256 = hashlib.sha256(b"x" * size).digest()
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
        assert result.mode == 0o600  # private file: owner rw- only
        assert result.owner == "7"
        assert result.checksum is not None

    def test_stat_public_file_has_world_read(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file(public=True)

        with patch.object(adapter, "_get_file", return_value=mock_file):
            result = adapter.stat("abc")

        assert result.mode == 0o604  # owner rw- + other r--

    def test_stat_no_content_gives_none_checksum(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()
        mock_file = self._make_file()
        mock_file.content = None

        with patch.object(adapter, "_get_file", return_value=mock_file):
            result = adapter.stat("abc")

        assert result.checksum is None
        assert result.size == 0

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

    def test_open_read_raises_when_no_content(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        mock_file = MagicMock()
        mock_file.content = None

        with patch.object(adapter, "_get_file", return_value=mock_file):
            with pytest.raises(FileNotFoundError):
                adapter.open_read("abc")


# ---------------------------------------------------------------------------
# PostgresAdapter.open_write tests
# ---------------------------------------------------------------------------


class TestPostgresAdapterOpenWrite:
    def _make_file(self, content_id=1, public=False):
        f = MagicMock()
        f.hash_id = "abc"
        f.user_id = 42
        f.public = public
        f.content_id = content_id
        return f

    def test_open_write_returns_false_when_content_unchanged(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        mock_file = self._make_file(content_id=99)

        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.FileContent") as mock_fc, \
             patch("neo4japp.storage.adapters.postgres.db") as _mock_db:
            mock_fc.get_or_create.return_value = 99  # Same content_id

            result = adapter.open_write("abc", io.BytesIO(b"same"))

        assert result is False

    def test_open_write_returns_true_and_updates_content_id(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        mock_file = self._make_file(content_id=1)

        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.FileContent") as mock_fc, \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db:
            mock_fc.get_or_create.return_value = 2  # New content_id
            mock_db.session.add = MagicMock()
            mock_db.session.flush = MagicMock()

            result = adapter.open_write("abc", io.BytesIO(b"new content"))

        assert result is True
        assert mock_file.content_id == 2

    def test_open_write_creates_version_when_previous_content_exists(self):
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        mock_file = self._make_file(content_id=1)

        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.FileContent") as mock_fc, \
             patch("neo4japp.storage.adapters.postgres.FileVersion") as mock_fv_cls, \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db:
            mock_fc.get_or_create.return_value = 2
            mock_version = MagicMock()
            mock_fv_cls.return_value = mock_version
            mock_db.session.query.return_value.filter.return_value.one_or_none.return_value = None

            adapter.open_write("abc", io.BytesIO(b"new"), author="user-hash")

        mock_db.session.add.assert_called_once_with(mock_version)

    def test_open_write_no_version_when_first_write(self):
        """When content_id is None (new file), no FileVersion should be created."""
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        adapter = PostgresAdapter()

        mock_file = self._make_file(content_id=None)

        with patch.object(adapter, "_get_file", return_value=mock_file), \
             patch("neo4japp.storage.adapters.postgres.FileContent") as mock_fc, \
             patch("neo4japp.storage.adapters.postgres.db") as mock_db:
            mock_fc.get_or_create.return_value = 1

            result = adapter.open_write("abc", io.BytesIO(b"initial"))

        assert result is True
        mock_db.session.add.assert_not_called()


# ---------------------------------------------------------------------------
# AzureDataLakeAdapter unit tests (all SDK calls are mocked)
# ---------------------------------------------------------------------------


class TestAzureDataLakeAdapterCapabilities:
    def _make_adapter(self):
        """Build an AzureDataLakeAdapter with fully mocked SDK clients."""
        from neo4japp.storage.adapters.azure_adls import AzureDataLakeAdapter

        with patch("neo4japp.storage.adapters.azure_adls.AzureDataLakeAdapter.__init__",
                   return_value=None):
            adapter = AzureDataLakeAdapter.__new__(AzureDataLakeAdapter)

        adapter._datalake_service = MagicMock()
        adapter._blob_service = MagicMock()
        adapter._filesystem = "test-fs"
        return adapter

    def test_capabilities(self):
        adapter = self._make_adapter()
        caps = adapter.capabilities
        assert caps.supports_acl is True
        assert caps.supports_versioning is True

    def test_stat_returns_filestat(self):
        adapter = self._make_adapter()

        mock_client = MagicMock()
        mock_client.get_file_properties.return_value = {
            "size": 100,
            "content_settings": {"content_type": "application/pdf"},
            "creation_time": None,
            "last_modified": None,
            "etag": "etag123",
            "lease": {"status": "unlocked"},
        }
        mock_client.get_access_control.return_value = {
            "permissions": "rw-r--r--",
            "owner": "user1",
            "group": "grp1",
        }
        adapter._datalake_service.get_file_system_client.return_value\
            .get_file_client.return_value = mock_client

        result = adapter.stat("myfile.txt")

        assert isinstance(result, FileStat)
        assert result.size == 100
        assert result.content_type == "application/pdf"
        assert result.mode == 0o644
        assert result.owner == "user1"
        assert result.group == "grp1"

    def test_chmod_calls_set_access_control(self):
        adapter = self._make_adapter()

        mock_client = MagicMock()
        adapter._datalake_service.get_file_system_client.return_value\
            .get_file_client.return_value = mock_client

        adapter.chmod("myfile.txt", 0o755)

        mock_client.set_access_control.assert_called_once_with(permissions="rwxr-xr-x")

    def test_chown_calls_set_access_control(self):
        adapter = self._make_adapter()

        mock_client = MagicMock()
        adapter._datalake_service.get_file_system_client.return_value\
            .get_file_client.return_value = mock_client

        adapter.chown("myfile.txt", "newowner", "newgroup")

        mock_client.set_access_control.assert_called_once_with(
            owner="newowner", group="newgroup"
        )

    def test_open_read_returns_bytesio(self):
        adapter = self._make_adapter()

        mock_client = MagicMock()
        mock_download = MagicMock()
        mock_download.readall.return_value = b"azure content"
        mock_client.download_file.return_value = mock_download
        adapter._datalake_service.get_file_system_client.return_value\
            .get_file_client.return_value = mock_client

        stream = adapter.open_read("myfile.txt")

        assert stream.read() == b"azure content"

    def test_open_write_returns_true(self):
        adapter = self._make_adapter()

        mock_client = MagicMock()
        adapter._datalake_service.get_file_system_client.return_value\
            .get_file_client.return_value = mock_client

        result = adapter.open_write("myfile.txt", io.BytesIO(b"data"))

        assert result is True
        mock_client.upload_data.assert_called_once()

    def test_list_revisions_returns_list(self):
        adapter = self._make_adapter()

        mock_container = MagicMock()
        blob1 = {
            "name": "myfile.txt",
            "version_id": "v1",
            "creation_time": datetime(2024, 1, 1),
            "size": 50,
            "etag": "etag1",
            "is_current_version": False,
        }
        mock_container.list_blobs.return_value = [blob1]
        adapter._blob_service.get_container_client.return_value = mock_container

        revisions = adapter.list_revisions("myfile.txt")

        assert len(revisions) == 1
        assert revisions[0].rev_id == "v1"

    def test_list_revisions_excludes_other_blobs(self):
        """Blobs with a different name must be filtered out."""
        adapter = self._make_adapter()

        mock_container = MagicMock()
        blob_other = {
            "name": "other.txt",
            "version_id": "v99",
            "creation_time": None,
            "size": 0,
            "etag": "x",
            "is_current_version": False,
        }
        mock_container.list_blobs.return_value = [blob_other]
        adapter._blob_service.get_container_client.return_value = mock_container

        revisions = adapter.list_revisions("myfile.txt")

        assert revisions == []

    def test_restore_revision_calls_start_copy(self):
        adapter = self._make_adapter()

        mock_blob_client = MagicMock()
        mock_blob_client.url = "https://example.com/blob"
        adapter._blob_service.get_blob_client.return_value = mock_blob_client
        adapter._blob_service.credential = MagicMock()

        mock_versioned = MagicMock()
        mock_versioned.url = "https://example.com/blob?versionId=v1"
        mock_blob_cls = MagicMock()
        mock_blob_cls.from_blob_url.return_value = mock_versioned

        azure_blob_mod = MagicMock()
        azure_blob_mod.BlobClient = mock_blob_cls

        with patch.dict("sys.modules", {"azure.storage.blob": azure_blob_mod}):
            adapter.restore_revision("myfile.txt", "v1")

        mock_blob_client.start_copy_from_url.assert_called_once_with(mock_versioned.url)


# ---------------------------------------------------------------------------
# GoogleDriveAdapter unit tests (all API calls are mocked)
# ---------------------------------------------------------------------------


class TestGoogleDriveAdapter:
    def _make_adapter(self):
        from neo4japp.storage.adapters.google_drive import GoogleDriveAdapter
        mock_service = MagicMock()
        return GoogleDriveAdapter(service=mock_service), mock_service

    def test_capabilities(self):
        adapter, _ = self._make_adapter()
        caps = adapter.capabilities
        assert caps.supports_acl is True
        assert caps.supports_versioning is True

    def test_stat_returns_filestat(self):
        adapter, mock_service = self._make_adapter()

        mock_service.files.return_value.get.return_value.execute.return_value = {
            "id": "file123",
            "name": "report.pdf",
            "mimeType": "application/pdf",
            "size": "2048",
            "createdTime": "2024-01-01T00:00:00Z",
            "modifiedTime": "2024-06-01T00:00:00Z",
            "owners": [{"emailAddress": "owner@example.com"}],
            "permissions": [{"role": "reader", "type": "anyone"}],
            "appProperties": {},
        }

        result = adapter.stat("file123")

        assert isinstance(result, FileStat)
        assert result.size == 2048
        assert result.content_type == "application/pdf"
        assert result.owner == "owner@example.com"

    def test_stat_raises_file_not_found(self):
        adapter, mock_service = self._make_adapter()

        mock_service.files.return_value.get.return_value.execute.side_effect = Exception(
            "404: File not found"
        )

        with pytest.raises(FileNotFoundError):
            adapter.stat("missing")

    def test_chmod_updates_existing_permission(self):
        adapter, mock_service = self._make_adapter()

        mock_service.files.return_value.get.return_value.execute.return_value = {
            "id": "file123",
            "name": "doc.pdf",
            "mimeType": "application/pdf",
            "size": "0",
            "owners": [],
            "permissions": [{"id": "perm1", "role": "reader", "type": "anyone"}],
            "appProperties": {},
        }

        adapter.chmod("file123", 0o644)

        mock_service.permissions.return_value.update.assert_called_once()

    def test_chmod_creates_permission_when_none_exist(self):
        adapter, mock_service = self._make_adapter()

        mock_service.files.return_value.get.return_value.execute.return_value = {
            "id": "file123",
            "name": "doc.pdf",
            "mimeType": "application/pdf",
            "size": "0",
            "owners": [{"emailAddress": "owner@example.com"}],
            "permissions": [{"id": "owner_perm", "role": "owner"}],
            "appProperties": {},
        }

        adapter.chmod("file123", 0o644)

        # Owner-only permission → new "anyone" permission created
        mock_service.permissions.return_value.create.assert_called_once()

    def test_chown_transfers_ownership(self):
        adapter, mock_service = self._make_adapter()

        mock_service.files.return_value.get.return_value.execute.return_value = {
            "id": "file123",
            "name": "doc.pdf",
            "mimeType": "application/pdf",
            "size": "0",
            "owners": [],
            "permissions": [{"id": "owner_perm", "role": "owner"}],
            "appProperties": {},
        }

        adapter.chown("file123", "new@example.com", "")

        mock_service.permissions.return_value.create.assert_called()

    def test_open_read_returns_bytes_stream(self):
        adapter, mock_service = self._make_adapter()

        mock_service.files.return_value.get_media.return_value.execute.return_value = b"drive data"

        stream = adapter.open_read("file123")

        assert stream.read() == b"drive data"

    def test_open_write_returns_true(self):
        adapter, mock_service = self._make_adapter()

        mock_service.files.return_value.get.return_value.execute.return_value = {
            "id": "file123",
            "mimeType": "text/plain",
        }

        with patch("neo4japp.storage.adapters.google_drive.GoogleDriveAdapter.open_write") as m:
            m.return_value = True
            result = adapter.open_write("file123", io.BytesIO(b"data"))

        assert result is True

    def test_list_revisions_newest_first(self):
        adapter, mock_service = self._make_adapter()

        mock_service.revisions.return_value.list.return_value.execute.return_value = {
            "revisions": [
                {"id": "r1", "modifiedTime": "2024-01-01T00:00:00Z",
                 "lastModifyingUser": {"emailAddress": "alice@example.com"},
                 "size": "100", "keepForever": False},
                {"id": "r2", "modifiedTime": "2024-06-01T00:00:00Z",
                 "lastModifyingUser": {"emailAddress": "bob@example.com"},
                 "size": "200", "keepForever": True},
            ]
        }

        revisions = adapter.list_revisions("file123")

        assert len(revisions) == 2
        # reversed() in the implementation means r2 (newest) comes first
        assert revisions[0].rev_id == "r2"
        assert revisions[1].rev_id == "r1"

    def test_get_revision_stream_returns_bytes(self):
        adapter, mock_service = self._make_adapter()

        mock_service.revisions.return_value.get_media.return_value.execute.return_value = (
            b"rev content"
        )

        stream = adapter.get_revision_stream("file123", "r1")

        assert stream.read() == b"rev content"
