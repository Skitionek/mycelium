"""
Storage abstraction layer for Lifelike.

Defines the IStorageProvider interface and the associated Pydantic data models.
Concrete adapters (PostgresAdapter, AzureDataLakeAdapter, GoogleDriveAdapter) live
in the ``adapters`` sub-package.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import BinaryIO, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class NotSupportedError(Exception):
    """Raised when a method is called on an adapter that does not support it."""

    def __init__(self, capability: str, adapter: str = "") -> None:
        adapter_info = f" (adapter: {adapter})" if adapter else ""
        super().__init__(
            f"'{capability}' is not supported by this storage provider{adapter_info}."
        )
        self.capability = capability
        self.adapter = adapter


# ---------------------------------------------------------------------------
# Pydantic data models
# ---------------------------------------------------------------------------


class StorageCapabilities(BaseModel):
    """Describes what optional features a storage provider supports."""

    supports_acl: bool = False
    """Whether the provider supports POSIX-style ACL operations (chmod / chown)."""

    supports_versioning: bool = False
    """Whether the provider supports file history / revisions."""


class FileStat(BaseModel):
    """Metadata returned by :meth:`IStorageProvider.stat`."""

    path: str
    size: int = 0
    """File size in bytes. May be 0 when the provider does not expose size."""

    content_type: Optional[str] = None
    """MIME type, if known."""

    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None

    # POSIX permission bits (e.g. 0o644).  Providers that don't support ACLs
    # return the default 0o644.
    mode: int = Field(default=0o644)

    owner: Optional[str] = None
    """Opaque owner identifier (username, user-id, email, etc.)."""

    group: Optional[str] = None
    """Opaque group identifier."""

    checksum: Optional[str] = None
    """Hex SHA-256 digest of the current content, if pre-computed by the provider."""

    extra: dict = Field(default_factory=dict)
    """Provider-specific metadata that does not fit the schema above."""


class Revision(BaseModel):
    """Represents a single historical version of a file."""

    rev_id: str
    """Opaque revision identifier (hash_id, blob version-id, GDrive revision id, …)."""

    path: str
    created_at: Optional[datetime] = None
    author: Optional[str] = None
    """Opaque author identifier (username, email, …)."""

    message: Optional[str] = None
    """Human-readable commit / version message, if any."""

    size: Optional[int] = None
    """Size of the revision content in bytes, if known."""

    extra: dict = Field(default_factory=dict)
    """Provider-specific metadata."""


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------


class IStorageProvider(ABC):
    """
    Abstract base class for all storage-backend adapters.

    Every concrete adapter must implement all abstract methods.  Optional
    capabilities (ACL operations) must raise :class:`NotSupportedError` when
    the adapter's :attr:`capabilities` declares them unsupported.
    """

    # ------------------------------------------------------------------
    # Capabilities
    # ------------------------------------------------------------------

    @property
    @abstractmethod
    def capabilities(self) -> StorageCapabilities:
        """Return a :class:`StorageCapabilities` object describing what this
        adapter supports at runtime."""

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------

    @abstractmethod
    def stat(self, path: str) -> FileStat:
        """Return metadata for the file at *path*.

        If the adapter does not support ACLs, the returned :class:`FileStat`
        should use the default POSIX mode (``0o644``) and leave *owner* /
        *group* as ``None``.

        :raises FileNotFoundError: if *path* does not exist.
        """

    # ------------------------------------------------------------------
    # ACL operations (optional)
    # ------------------------------------------------------------------

    def chmod(self, path: str, mode: int) -> None:
        """Set POSIX permission bits on *path*.

        :raises NotSupportedError: if :attr:`capabilities.supports_acl` is
            ``False``.
        :raises FileNotFoundError: if *path* does not exist.
        """
        if not self.capabilities.supports_acl:
            raise NotSupportedError("chmod", type(self).__name__)

    def chown(self, path: str, uid: str, gid: str) -> None:
        """Change the owner and group of *path*.

        *uid* and *gid* are opaque provider-specific identifiers (e.g. an
        e-mail address, a UUID, or a numeric string).

        :raises NotSupportedError: if :attr:`capabilities.supports_acl` is
            ``False``.
        :raises FileNotFoundError: if *path* does not exist.
        """
        if not self.capabilities.supports_acl:
            raise NotSupportedError("chown", type(self).__name__)

    # ------------------------------------------------------------------
    # History / versioning
    # ------------------------------------------------------------------

    @abstractmethod
    def list_revisions(self, path: str) -> List[Revision]:
        """Return a list of :class:`Revision` objects for *path*, most-recent
        first.

        :raises FileNotFoundError: if *path* does not exist.
        :raises NotSupportedError: if :attr:`capabilities.supports_versioning`
            is ``False``.
        """

    @abstractmethod
    def get_revision_stream(self, path: str, rev_id: str) -> BinaryIO:
        """Return a readable binary stream for the given revision.

        :raises FileNotFoundError: if *path* or *rev_id* does not exist.
        :raises NotSupportedError: if :attr:`capabilities.supports_versioning`
            is ``False``.
        """

    @abstractmethod
    def restore_revision(self, path: str, rev_id: str) -> None:
        """Restore *path* to the content of *rev_id*, creating a new revision
        that is identical to the requested historical one.

        :raises FileNotFoundError: if *path* or *rev_id* does not exist.
        :raises NotSupportedError: if :attr:`capabilities.supports_versioning`
            is ``False``.
        """

    # ------------------------------------------------------------------
    # IO
    # ------------------------------------------------------------------

    @abstractmethod
    def open_read(self, path: str) -> BinaryIO:
        """Return a readable binary stream for the current content of *path*.

        :raises FileNotFoundError: if *path* does not exist.
        """

    @abstractmethod
    def open_write(
        self,
        path: str,
        stream: BinaryIO,
        *,
        size: Optional[int] = None,
        author: Optional[str] = None,
    ) -> bool:
        """Write *stream* to *path*, creating or replacing the file.

        :param path: Destination path.
        :param stream: Readable binary stream whose content will be stored.
        :param size: Optional hint for the number of bytes to write.  Some
            providers require this for streaming uploads.
        :param author: Opaque author identifier (e.g. a user hash-id or
            e-mail address) recorded on the new revision, if the provider
            supports versioning.
        :returns: ``True`` if the stored content changed, ``False`` when the
            new content is byte-for-byte identical to the current content and
            the provider detected this (e.g. via content-addressable storage).
            Cloud providers that do not deduplicate always return ``True``.
        """
