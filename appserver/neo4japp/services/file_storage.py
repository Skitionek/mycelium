"""
File storage service backed by apache-libcloud Object Storage API.

This service abstracts the underlying storage backend so that user file
content can be served from any libcloud-compatible provider (Azure Blobs,
S3, GCS, local filesystem, …) with no changes to calling code.
"""
from typing import Optional

from libcloud.storage.types import ContainerDoesNotExistError, ObjectDoesNotExistError


class FileStorageService:
    """Service for storing and retrieving user file content via object storage.

    Uses the apache-libcloud :class:`~libcloud.storage.base.StorageDriver`
    interface so that the concrete storage backend can be swapped by changing
    the driver (e.g. ``Provider.AZURE_BLOBS``, ``Provider.S3``,
    ``Provider.LOCAL``).

    File objects are addressed by their *revision*, which is the hex-encoded
    SHA-256 checksum of the content (``FileContent.revision``).  This
    maps directly onto the libcloud ``object_name`` so the same bytes are
    always stored under the same key — enabling content-addressed deduplication.
    """

    def __init__(self, driver, container_name: str) -> None:
        self.driver = driver
        self.container_name = container_name

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_or_create_container(self):
        """Return the target container, creating it if it does not exist."""
        try:
            return self.driver.get_container(self.container_name)
        except ContainerDoesNotExistError:
            return self.driver.create_container(self.container_name)

    # ------------------------------------------------------------------
    # Public API — mirrors the libcloud StorageDriver interface
    # ------------------------------------------------------------------

    def store(self, revision: str, data: bytes) -> None:
        """Upload *data* to the container under *revision*.

        Corresponds to :meth:`~libcloud.storage.base.StorageDriver.upload_object_via_stream`.

        :param revision: content revision key — the hex-encoded SHA-256 of *data*
            (i.e. ``FileContent.revision``).
        :param data: raw bytes to store.
        """
        container = self._get_or_create_container()
        self.driver.upload_object_via_stream(
            iterator=iter([data]),
            container=container,
            object_name=revision,
        )

    def retrieve(self, revision: str) -> Optional[bytes]:
        """Download and return the bytes stored under *revision*.

        Corresponds to :meth:`~libcloud.storage.base.StorageDriver.download_object_as_stream`.
        Returns ``None`` if the object does not exist.

        :param revision: content revision key (``FileContent.revision``).
        :return: file bytes, or ``None`` if the object was not found.
        """
        try:
            obj = self.driver.get_object(self.container_name, revision)
            return b''.join(self.driver.download_object_as_stream(obj))
        except ObjectDoesNotExistError:
            return None

    def delete(self, revision: str) -> bool:
        """Delete the object identified by *revision*.

        Corresponds to :meth:`~libcloud.storage.base.StorageDriver.delete_object`.
        Returns ``False`` when the object does not exist rather than raising.

        :param revision: content revision key (``FileContent.revision``).
        :return: ``True`` if deleted, ``False`` if it did not exist.
        """
        try:
            obj = self.driver.get_object(self.container_name, revision)
            return self.driver.delete_object(obj)
        except ObjectDoesNotExistError:
            return False
