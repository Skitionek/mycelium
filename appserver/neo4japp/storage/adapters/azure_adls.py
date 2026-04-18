"""
AzureDataLakeAdapter — storage adapter backed by Azure Data Lake Storage Gen2.

Capabilities
------------
* ``supports_acl``        = ``True``  — ADLS Gen2 has first-class POSIX ACL
  support via the :meth:`DataLakeFileClient.set_access_control` API.
* ``supports_versioning`` = ``True``  — leverages Azure Blob Storage's native
  *Blob Versioning* feature (must be enabled on the storage account).

Prerequisites
-------------
The following packages must be installed::

    azure-storage-file-datalake>=12
    azure-storage-blob>=12

Configuration is supplied via constructor arguments or through
:func:`from_env` which reads the standard Azure environment variables:

``AZURE_STORAGE_ACCOUNT_URL``
    Full endpoint URL, e.g. ``https://<account>.dfs.core.windows.net``.
``AZURE_STORAGE_CREDENTIAL``
    An :class:`azure.identity.DefaultAzureCredential` is used when this is
    ``None``; pass a SAS token or account key string to override.
``AZURE_STORAGE_FILESYSTEM``
    The Data Lake filesystem (container) name.

Path convention
---------------
*path* is always a forward-slash-separated path relative to the filesystem
root, e.g. ``"projects/my-project/report.pdf"``.  Leading slashes are
stripped for consistency.
"""

from __future__ import annotations

import io
import os
from typing import BinaryIO, List, Optional

from neo4japp.storage.interface import (
    FileStat,
    IStorageProvider,
    NotSupportedError,
    Revision,
    StorageCapabilities,
)


def _strip_leading_slash(path: str) -> str:
    return path.lstrip("/")


class AzureDataLakeAdapter(IStorageProvider):
    """Storage adapter for Azure Data Lake Storage Gen2.

    :param account_url: Full ADLS Gen2 DFS endpoint, e.g.
        ``https://<account>.dfs.core.windows.net``.
    :param filesystem: Name of the Data Lake filesystem (container).
    :param credential: Azure credential accepted by the Azure SDK (account
        key string, SAS token string, or a ``TokenCredential`` object).
        When ``None``, :class:`azure.identity.DefaultAzureCredential` is used.
    :param blob_account_url: Full Blob Storage endpoint used for accessing
        versioning APIs, e.g. ``https://<account>.blob.core.windows.net``.
        Defaults to *account_url* with ``.dfs.`` replaced by ``.blob.``.
    """

    _CAPABILITIES = StorageCapabilities(supports_acl=True, supports_versioning=True)

    def __init__(
        self,
        account_url: str,
        filesystem: str,
        credential=None,
        blob_account_url: Optional[str] = None,
    ) -> None:
        # Lazy imports so that the adapter module can be imported even when the
        # azure-storage-file-datalake package is absent (unit-test scenarios).
        try:
            from azure.storage.filedatalake import DataLakeServiceClient
            from azure.storage.blob import BlobServiceClient
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "azure-storage-file-datalake and azure-storage-blob are required "
                "for AzureDataLakeAdapter. Install them with: "
                "pip install azure-storage-file-datalake azure-storage-blob"
            ) from exc

        if credential is None:
            from azure.identity import DefaultAzureCredential  # pragma: no cover
            credential = DefaultAzureCredential()  # pragma: no cover

        self._datalake_service: "DataLakeServiceClient" = DataLakeServiceClient(
            account_url=account_url, credential=credential
        )
        self._filesystem = filesystem

        blob_url = blob_account_url or account_url.replace(".dfs.", ".blob.")
        self._blob_service: "BlobServiceClient" = BlobServiceClient(
            account_url=blob_url, credential=credential
        )

    @classmethod
    def from_env(cls) -> "AzureDataLakeAdapter":
        """Construct an adapter from standard Azure environment variables."""
        return cls(
            account_url=os.environ["AZURE_STORAGE_ACCOUNT_URL"],
            filesystem=os.environ["AZURE_STORAGE_FILESYSTEM"],
            credential=os.environ.get("AZURE_STORAGE_CREDENTIAL"),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _file_client(self, path: str):
        """Return an ADLS ``DataLakeFileClient`` for *path*."""
        return self._datalake_service.get_file_system_client(
            self._filesystem
        ).get_file_client(_strip_leading_slash(path))

    def _blob_client(self, path: str):
        """Return a Blob Storage ``BlobClient`` for *path* (used for versioning)."""
        return self._blob_service.get_blob_client(
            container=self._filesystem,
            blob=_strip_leading_slash(path),
        )

    # ------------------------------------------------------------------
    # Capabilities
    # ------------------------------------------------------------------

    @property
    def capabilities(self) -> StorageCapabilities:
        return self._CAPABILITIES

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------

    def stat(self, path: str) -> FileStat:
        client = self._file_client(path)
        props = client.get_file_properties()

        acl_info = client.get_access_control()
        permissions_str: str = acl_info.get("permissions", "")
        mode = _posix_str_to_mode(permissions_str)

        return FileStat(
            path=path,
            size=props.get("size", 0),
            content_type=props.get("content_settings", {}).get("content_type"),
            created_at=props.get("creation_time"),
            modified_at=props.get("last_modified"),
            mode=mode,
            owner=acl_info.get("owner"),
            group=acl_info.get("group"),
            extra={
                "etag": props.get("etag"),
                "lease_status": props.get("lease", {}).get("status"),
            },
        )

    # ------------------------------------------------------------------
    # ACL operations
    # ------------------------------------------------------------------

    def chmod(self, path: str, mode: int) -> None:
        """Set POSIX permission bits using ADLS Gen2 native ACLs.

        *mode* is a standard POSIX integer (e.g. ``0o755``).  It is
        translated to the ``rwxrwxrwx`` string format expected by the
        ADLS ``set_access_control`` API.
        """
        client = self._file_client(path)
        permissions = _mode_to_posix_str(mode)
        client.set_access_control(permissions=permissions)

    def chown(self, path: str, uid: str, gid: str) -> None:
        """Change the owner/group of *path* using ADLS Gen2 native ACLs.

        *uid* and *gid* must be Azure AD object IDs or ``$superuser``.
        """
        client = self._file_client(path)
        client.set_access_control(owner=uid, group=gid)

    # ------------------------------------------------------------------
    # History / versioning (Blob Versioning API)
    # ------------------------------------------------------------------

    def list_revisions(self, path: str) -> List[Revision]:
        """List all Blob Storage versions for *path*, newest first.

        Blob Versioning must be enabled on the storage account.
        """
        blob_client = self._blob_client(path)
        container_client = self._blob_service.get_container_client(self._filesystem)

        blob_name = _strip_leading_slash(path)
        versions = list(
            container_client.list_blobs(
                name_starts_with=blob_name, include=["versions"]
            )
        )
        # Filter to exact blob name and exclude the current (non-versioned) entry.
        revisions = []
        for blob in versions:
            if blob["name"] != blob_name:
                continue
            version_id = blob.get("version_id")
            if version_id is None:
                continue
            revisions.append(
                Revision(
                    rev_id=version_id,
                    path=path,
                    created_at=blob.get("creation_time"),
                    size=blob.get("size"),
                    extra={"etag": blob.get("etag"), "is_current_version": blob.get("is_current_version", False)},
                )
            )
        revisions.sort(key=lambda r: r.created_at or "", reverse=True)
        return revisions

    def get_revision_stream(self, path: str, rev_id: str) -> BinaryIO:
        """Download the content of blob version *rev_id* as a binary stream."""
        from azure.storage.blob import BlobClient

        blob_url = self._blob_client(path).url
        versioned_client = BlobClient.from_blob_url(
            blob_url, version_id=rev_id, credential=self._blob_service.credential
        )
        download = versioned_client.download_blob()
        return io.BytesIO(download.readall())

    def restore_revision(self, path: str, rev_id: str) -> None:
        """Copy blob version *rev_id* over the current blob, creating a new version."""
        from azure.storage.blob import BlobClient

        blob_url = self._blob_client(path).url
        versioned_client = BlobClient.from_blob_url(
            blob_url, version_id=rev_id, credential=self._blob_service.credential
        )
        current_client = self._blob_client(path)
        current_client.start_copy_from_url(versioned_client.url)

    # ------------------------------------------------------------------
    # IO
    # ------------------------------------------------------------------

    def open_read(self, path: str) -> BinaryIO:
        """Download the current content of *path* as a binary stream."""
        client = self._file_client(path)
        download = client.download_file()
        return io.BytesIO(download.readall())

    def open_write(
        self, path: str, stream: BinaryIO, size: Optional[int] = None
    ) -> None:
        """Upload *stream* to *path*, replacing any existing content."""
        client = self._file_client(path)
        data = stream.read()
        client.upload_data(data, overwrite=True, length=len(data))


# ---------------------------------------------------------------------------
# POSIX mode helpers
# ---------------------------------------------------------------------------


def _posix_str_to_mode(permissions: str) -> int:
    """Convert a ``rwxrwxrwx`` string (9 chars) to an integer mode.

    Extra characters (sticky, setuid, etc.) beyond the first 9 are ignored.
    Unknown or empty strings return the default ``0o644``.
    """
    if len(permissions) < 9:
        return 0o644
    result = 0
    mapping = (
        (0, 0o400), (1, 0o200), (2, 0o100),
        (3, 0o040), (4, 0o020), (5, 0o010),
        (6, 0o004), (7, 0o002), (8, 0o001),
    )
    for idx, bit in mapping:
        if permissions[idx] != "-":
            result |= bit
    return result


def _mode_to_posix_str(mode: int) -> str:
    """Convert an integer mode (e.g. ``0o755``) to a ``rwxrwxrwx`` string."""
    chars = []
    for shift, char in [
        (8, "r"), (7, "w"), (6, "x"),
        (5, "r"), (4, "w"), (3, "x"),
        (2, "r"), (1, "w"), (0, "x"),
    ]:
        chars.append(char if mode & (1 << shift) else "-")
    return "".join(chars)
