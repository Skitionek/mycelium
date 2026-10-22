"""
apache-libcloud StorageDriver implementation backed by PostgreSQL.

This driver stores file objects in the ``files_content`` PostgreSQL table
so that the rest of the application can use the standard libcloud
``StorageDriver`` interface without depending on an external blob-storage
service.  To switch to a different backend (Azure Blobs, S3, GCS, …) only
the driver needs to be swapped — calling code is unchanged.

Object names are the hex-encoded SHA-256 checksums of the file contents
(i.e. ``checksum_sha256.hex()``), which matches the unique index already
present on the table.
"""
from libcloud.storage.base import Container, Object, StorageDriver
from libcloud.storage.types import (
    ContainerDoesNotExistError,
    ObjectDoesNotExistError,
)

# The table/container "name" used when code does not explicitly specify one.
DEFAULT_CONTAINER = 'files_content'


class PostgreSQLStorageDriver(StorageDriver):
    """libcloud :class:`~libcloud.storage.base.StorageDriver` that stores
    objects in the ``files_content`` PostgreSQL table via SQLAlchemy.

    The ``key`` constructor parameter is accepted for API compatibility but
    is not used; the driver always reads/writes through the SQLAlchemy
    session that is active on the current Flask request (``db.session``).

    Container names are decorative — every container maps to the same
    underlying ``files_content`` table.
    """

    name = 'PostgreSQL File Storage'
    website = 'https://postgresql.org'

    def __init__(self, key='postgresql', secret=None, **kwargs):
        # key/secret are accepted for libcloud API compatibility but unused.
        super().__init__(key=key, secret=secret, **kwargs)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_session():
        from neo4japp.database import db
        return db.session

    @staticmethod
    def _make_container(container_name: str, driver) -> Container:
        return Container(name=container_name, extra={}, driver=driver)

    @classmethod
    def _make_object(cls, row, container: Container, driver) -> Object:
        size = len(row.raw_file) if row.raw_file is not None else 0
        return Object(
            name=row.checksum_sha256.hex(),
            size=size,
            hash=row.checksum_sha256.hex(),
            extra={},
            meta_data={},
            container=container,
            driver=driver,
        )

    @classmethod
    def _find_row(cls, object_name: str):
        """Return the FileContent row for *object_name* (checksum hex) or None."""
        from neo4japp.models.files import FileContent
        try:
            checksum = bytes.fromhex(object_name)
        except ValueError:
            return None
        return cls._get_session().query(FileContent).filter(
            FileContent.checksum_sha256 == checksum
        ).first()

    # ------------------------------------------------------------------
    # libcloud StorageDriver API
    # ------------------------------------------------------------------

    def iterate_containers(self):
        yield self._make_container(DEFAULT_CONTAINER, self)

    def iterate_objects(self, container):
        from neo4japp.models.files import FileContent
        for row in self._get_session().query(FileContent).all():
            yield self._make_object(row, container, self)

    def get_container(self, container_name: str) -> Container:
        # Every container name resolves to the single files_content table.
        return self._make_container(container_name, self)

    def create_container(self, container_name: str) -> Container:
        # The table always exists; nothing to create.
        return self._make_container(container_name, self)

    def delete_container(self, container) -> bool:
        # The table is never dropped via the storage API.
        return False

    def get_object(self, container_name: str, object_name: str) -> Object:
        row = self._find_row(object_name)
        if row is None:
            raise ObjectDoesNotExistError(
                value=object_name, driver=self, object_name=object_name
            )
        container = self._make_container(container_name, self)
        return self._make_object(row, container, self)

    def download_object_as_stream(self, obj, chunk_size=None):
        """Yield the raw bytes stored in ``files_content.raw_file``."""
        row = self._find_row(obj.name)
        if row is None:
            raise ObjectDoesNotExistError(
                value=obj.name, driver=self, object_name=obj.name
            )
        data = row.raw_file
        if chunk_size:
            for i in range(0, len(data), chunk_size):
                yield data[i:i + chunk_size]
        else:
            yield data

    def upload_object_via_stream(
        self, iterator, container, object_name, extra=None, object_headers=None
    ) -> Object:
        """Write *iterator* bytes to ``files_content.raw_file``.

        If a row with the same checksum already exists it is returned
        unchanged (idempotent, content-addressed storage).
        """
        from neo4japp.models.files import FileContent

        data = b''.join(iterator)
        try:
            checksum = bytes.fromhex(object_name)
        except ValueError as exc:
            raise ValueError(
                f"object_name must be a 64-character hex-encoded SHA-256 checksum, "
                f"got {object_name!r}"
            ) from exc

        session = self._get_session()
        row = session.query(FileContent).filter(
            FileContent.checksum_sha256 == checksum
        ).first()

        if row is None:
            row = FileContent()
            row.checksum_sha256 = checksum
            row.raw_file = data
            session.add(row)
            session.flush()

        return self._make_object(row, container, self)

    def delete_object(self, obj) -> bool:
        """Delete the ``files_content`` row for *obj*.

        Returns ``True`` if the row was deleted, ``False`` if it did not exist.
        Note: callers should ensure no ``files`` row still references this
        content (FK constraint) before calling this method.
        """
        row = self._find_row(obj.name)
        if row is None:
            return False
        self._get_session().delete(row)
        return True

    # ------------------------------------------------------------------
    # Unused abstract methods (required by libcloud's StorageDriver ABC)
    # ------------------------------------------------------------------

    def download_object(self, obj, destination_path, overwrite_existing=False,
                        delete_on_failure=True):  # pragma: no cover
        raise NotImplementedError

    def upload_object(self, file_path, container, object_name, extra=None,
                      verify_hash=True, headers=None):  # pragma: no cover
        raise NotImplementedError
