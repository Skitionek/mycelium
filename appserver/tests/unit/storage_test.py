"""Unit tests for FileStorageService and PostgreSQLStorageDriver."""
import hashlib
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from libcloud.storage.types import ObjectDoesNotExistError

from neo4japp.services.file_storage import FileStorageService
from neo4japp.services.storage_drivers.postgresql import PostgreSQLStorageDriver


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_driver():
    """Return a PostgreSQLStorageDriver with a mocked DB session."""
    driver = PostgreSQLStorageDriver.__new__(PostgreSQLStorageDriver)
    driver.key = 'postgresql'
    driver.secret = None
    return driver


def _checksum(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def _checksum_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# PostgreSQLStorageDriver
# ---------------------------------------------------------------------------

class TestPostgreSQLStorageDriver:
    """Tests for PostgreSQLStorageDriver.upload_object_via_stream /
    download_object_as_stream / get_object / delete_object."""

    def _make_row(self, data: bytes):
        row = MagicMock()
        row.raw_file = data
        row.checksum_sha256 = _checksum(data)
        return row

    def _make_container(self, driver):
        from neo4japp.services.storage_drivers.postgresql import DEFAULT_CONTAINER
        return driver.get_container(DEFAULT_CONTAINER)

    def test_upload_then_download(self):
        data = b'hello libcloud'
        checksum_hex = _checksum_hex(data)
        driver = _make_driver()

        row = self._make_row(data)
        # First call (new row): not found; second call (retrieve): returns row.
        session = MagicMock()
        session.query.return_value.filter.return_value.first.return_value = None

        def _find_row_side_effect(object_name):
            if object_name == checksum_hex:
                return row
            return None

        with patch.object(type(driver), '_get_session', return_value=session), \
             patch.object(type(driver), '_find_row',
                          staticmethod(_find_row_side_effect)):
            container = self._make_container(driver)
            obj = driver.upload_object_via_stream(
                iterator=iter([data]),
                container=container,
                object_name=checksum_hex,
            )
            assert obj.name == checksum_hex
            assert obj.hash == checksum_hex

            chunks = list(driver.download_object_as_stream(obj))
            assert b''.join(chunks) == data

    def test_upload_checksum_mismatch_raises(self):
        driver = _make_driver()
        session = MagicMock()
        wrong_hex = _checksum_hex(b'wrong data')
        actual_data = b'actual data'

        with patch.object(type(driver), '_get_session', return_value=session):
            container = self._make_container(driver)
            with pytest.raises(ValueError, match='SHA-256 checksum mismatch'):
                driver.upload_object_via_stream(
                    iterator=iter([actual_data]),
                    container=container,
                    object_name=wrong_hex,
                )

    def test_upload_bad_object_name_raises(self):
        driver = _make_driver()
        session = MagicMock()
        with patch.object(type(driver), '_get_session', return_value=session):
            container = self._make_container(driver)
            with pytest.raises(ValueError, match='object_name must be'):
                driver.upload_object_via_stream(
                    iterator=iter([b'x']),
                    container=container,
                    object_name='not-a-hex-checksum',
                )

    def test_upload_idempotent(self):
        """Uploading the same bytes twice should not create a new row."""
        data = b'idempotent'
        checksum_hex = _checksum_hex(data)
        driver = _make_driver()
        row = self._make_row(data)
        session = MagicMock()
        # Row already exists.
        session.query.return_value.filter.return_value.first.return_value = row

        with patch.object(type(driver), '_get_session', return_value=session):
            container = self._make_container(driver)
            driver.upload_object_via_stream(
                iterator=iter([data]),
                container=container,
                object_name=checksum_hex,
            )
            # session.add should NOT have been called.
            session.add.assert_not_called()

    def test_get_object_not_found_raises(self):
        driver = _make_driver()
        with patch.object(type(driver), '_find_row', staticmethod(lambda _: None)):
            with pytest.raises(ObjectDoesNotExistError):
                driver.get_object('files_content', 'a' * 64)

    def test_delete_object_returns_false_when_not_found(self):
        driver = _make_driver()
        with patch.object(type(driver), '_find_row', staticmethod(lambda _: None)):
            obj = MagicMock()
            obj.name = 'a' * 64
            assert driver.delete_object(obj) is False

    def test_delete_object_returns_true_when_found(self):
        data = b'to delete'
        driver = _make_driver()
        row = self._make_row(data)
        session = MagicMock()

        with patch.object(type(driver), '_find_row',
                          staticmethod(lambda _: row)), \
             patch.object(type(driver), '_get_session', return_value=session):
            obj = MagicMock()
            obj.name = _checksum_hex(data)
            assert driver.delete_object(obj) is True
            session.delete.assert_called_once_with(row)

    def test_iterate_objects_uses_yield_per(self):
        """iterate_objects must not call .all() — it should use yield_per."""
        driver = _make_driver()
        row = self._make_row(b'stream')
        session = MagicMock()
        query_mock = MagicMock()
        exec_opts_mock = MagicMock()
        exec_opts_mock.yield_per.return_value = [row]
        query_mock.execution_options.return_value = exec_opts_mock
        session.query.return_value = query_mock

        with patch.object(type(driver), '_get_session', return_value=session):
            from neo4japp.services.storage_drivers.postgresql import DEFAULT_CONTAINER
            container = driver.get_container(DEFAULT_CONTAINER)
            objects = list(driver.iterate_objects(container))

        # .all() must not have been called.
        query_mock.all.assert_not_called()
        exec_opts_mock.yield_per.assert_called_once_with(100)
        assert len(objects) == 1


# ---------------------------------------------------------------------------
# FileStorageService
# ---------------------------------------------------------------------------

class TestFileStorageService:
    """Tests for FileStorageService.store / retrieve / delete."""

    def _make_service(self, driver):
        return FileStorageService(driver=driver, container_name='test-bucket')

    def _make_driver(self, row_data: bytes = None):
        """Return a mocked PostgreSQLStorageDriver."""
        driver = MagicMock()
        container = MagicMock()
        driver.get_container.return_value = container
        driver.create_container.return_value = container

        if row_data is not None:
            obj = MagicMock()
            obj.name = _checksum_hex(row_data)
            driver.get_object.return_value = obj
            driver.download_object_as_stream.return_value = iter([row_data])
        else:
            driver.get_object.side_effect = ObjectDoesNotExistError(
                value='', driver=driver, object_name=''
            )

        return driver

    def test_store_calls_upload_via_stream(self):
        driver = self._make_driver()
        svc = self._make_service(driver)
        data = b'store me'
        svc.store(_checksum_hex(data), data)
        driver.upload_object_via_stream.assert_called_once()

    def test_retrieve_returns_bytes_when_found(self):
        data = b'find me'
        driver = self._make_driver(row_data=data)
        svc = self._make_service(driver)
        result = svc.retrieve(_checksum_hex(data))
        assert result == data

    def test_retrieve_returns_none_when_missing(self):
        driver = self._make_driver()  # no row_data → raises ObjectDoesNotExistError
        svc = self._make_service(driver)
        result = svc.retrieve('a' * 64)
        assert result is None

    def test_delete_returns_true_when_found(self):
        data = b'delete me'
        driver = self._make_driver(row_data=data)
        driver.delete_object.return_value = True
        svc = self._make_service(driver)
        assert svc.delete(_checksum_hex(data)) is True

    def test_delete_returns_false_when_missing(self):
        driver = self._make_driver()
        svc = self._make_service(driver)
        assert svc.delete('a' * 64) is False
