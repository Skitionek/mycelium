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

    File objects are addressed by a **path** — the ``hash_id`` of the owning
    ``Files`` row for the current content, or the ``hash_id`` of a
    ``FileVersion`` row for a historical snapshot.  This path maps directly
    onto the libcloud ``object_name``.
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

    def store(self, name: str, data: bytes) -> None:
        """Upload *data* to the container under *name*.

        Corresponds to :meth:`~libcloud.storage.base.StorageDriver.upload_object_via_stream`.

        :param name: object path — ``Files.hash_id`` for the current file
            content, or ``FileVersion.hash_id`` for a historical snapshot.
        :param data: raw bytes to store.
        """
        container = self._get_or_create_container()
        self.driver.upload_object_via_stream(
            iterator=iter([data]),
            container=container,
            object_name=name,
        )

    def retrieve(self, name: str) -> Optional[bytes]:
        """Download and return the bytes stored under *name*.

        Corresponds to :meth:`~libcloud.storage.base.StorageDriver.download_object_as_stream`.
        Returns ``None`` if the object does not exist.

        :param name: object path (``Files.hash_id`` or ``FileVersion.hash_id``).
        :return: file bytes, or ``None`` if the object was not found.
        """
        try:
            obj = self.driver.get_object(self.container_name, name)
            return b''.join(self.driver.download_object_as_stream(obj))
        except ObjectDoesNotExistError:
            return None

    def delete(self, name: str) -> bool:
        """Delete the object identified by *name*.

        Corresponds to :meth:`~libcloud.storage.base.StorageDriver.delete_object`.
        Returns ``False`` when the object does not exist rather than raising.

        :param name: object path (``Files.hash_id`` or ``FileVersion.hash_id``).
        :return: ``True`` if deleted, ``False`` if it did not exist.
        """
        try:
            obj = self.driver.get_object(self.container_name, name)
            return self.driver.delete_object(obj)
        except ObjectDoesNotExistError:
            return False
