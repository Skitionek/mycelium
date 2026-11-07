"""
GoogleDriveAdapter — storage adapter backed by Google Drive.

Capabilities
------------
* ``supports_acl``        = ``True``  — Google Drive has a rich permissions
  model.  This adapter maps Drive permission *roles* to POSIX-like read/write
  bits using the following convention:

  =========  ===============
  Drive role  POSIX meaning
  =========  ===============
  owner       rwx (0o700)
  organizer   rwx (0o700)
  fileOrganizer rwx (0o700)
  writer      rw- (0o600)
  commenter   r-- (0o400)
  reader      r-- (0o400)
  =========  ===============

  :meth:`chmod` encodes the requested mode back to the closest Drive role and
  updates the *first non-owner* permission found on the file.  :meth:`chown`
  transfers ownership via the Drive *permissions.update* API.

* ``supports_versioning`` = ``True``  — the Google Drive Revisions API
  (``revisions.list`` / ``revisions.get``) provides full version history for
  files stored natively in Drive.

Prerequisites
-------------
Install the Google client library::

    pip install google-api-python-client google-auth

Configuration is supplied via constructor arguments or :func:`from_service_account_file`.

Path convention
---------------
*path* is a **Google Drive File ID** (a 33-character opaque string such as
``1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms``).  All Drive objects are
addressed by their immutable file ID rather than a hierarchical path, as
Drive does not have a true filesystem hierarchy.

Non-native metadata is stored in the file's ``appProperties`` field under
the key ``lifelike_meta`` as a JSON blob.
"""

from __future__ import annotations

import io
import json
from typing import BinaryIO, Dict, List, Optional

from neo4japp.storage.interface import (
    FileStat,
    IStorageProvider,
    Revision,
    StorageCapabilities,
)


# ---------------------------------------------------------------------------
# Drive role ↔ POSIX mode mapping
# ---------------------------------------------------------------------------

_ROLE_TO_MODE: Dict[str, int] = {
    "owner": 0o700,
    "organizer": 0o700,
    "fileOrganizer": 0o700,
    "writer": 0o600,
    "commenter": 0o400,
    "reader": 0o400,
}

_MODE_TO_ROLE: List[tuple] = [
    (0o600, "writer"),
    (0o400, "commenter"),
    (0o000, "reader"),
]


def _role_to_mode(role: str) -> int:
    return _ROLE_TO_MODE.get(role, 0o400)


def _mode_to_role(mode: int) -> str:
    """Return the Drive role that best matches *mode*."""
    # Check write bits for owner/group/other
    if mode & 0o200 or mode & 0o020 or mode & 0o002:
        return "writer"
    if mode & 0o400 or mode & 0o040 or mode & 0o004:
        return "commenter"
    return "reader"


class GoogleDriveAdapter(IStorageProvider):
    """Storage adapter for Google Drive.

    :param service: An authenticated ``googleapiclient.discovery.Resource``
        object for the Drive API v3.  Build it with
        ``build('drive', 'v3', credentials=creds)``.
    """

    _CAPABILITIES = StorageCapabilities(supports_acl=True, supports_versioning=True)

    def __init__(self, service) -> None:
        self._service = service

    @classmethod
    def from_service_account_file(
        cls, service_account_file: str, scopes: Optional[List[str]] = None
    ) -> "GoogleDriveAdapter":
        """Build the adapter from a service-account JSON key file.

        :param service_account_file: Path to the service account JSON file.
        :param scopes: OAuth2 scopes. Defaults to Drive full-access.
        """
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "google-api-python-client and google-auth are required for "
                "GoogleDriveAdapter. Install them with: "
                "pip install google-api-python-client google-auth"
            ) from exc

        if scopes is None:
            scopes = ["https://www.googleapis.com/auth/drive"]

        credentials = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=scopes
        )
        service = build("drive", "v3", credentials=credentials)
        return cls(service)

    # ------------------------------------------------------------------
    # Capabilities
    # ------------------------------------------------------------------

    @property
    def capabilities(self) -> StorageCapabilities:
        return self._CAPABILITIES

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_file_meta(self, file_id: str) -> dict:
        """Return Drive file metadata for *file_id*."""
        try:
            return (
                self._service.files()
                .get(
                    fileId=file_id,
                    fields=(
                        "id,name,mimeType,size,createdTime,modifiedTime,"
                        "owners,permissions,appProperties"
                    ),
                )
                .execute()
            )
        except Exception as exc:
            # Translate Drive 404 to FileNotFoundError
            msg = str(exc)
            if "404" in msg or "File not found" in msg:
                raise FileNotFoundError(f"Drive file not found: {file_id!r}") from exc
            raise

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------

    def stat(self, path: str) -> FileStat:
        meta = self._get_file_meta(path)

        # Derive POSIX mode from the first non-owner permission found.
        # If only the owner exists, treat as 0o600 (owner read/write).
        mode = 0o600
        for perm in meta.get("permissions", []):
            if perm.get("role") not in ("owner", "organizer"):
                mode = _role_to_mode(perm["role"])
                break

        owners = meta.get("owners", [])
        owner_email = owners[0].get("emailAddress") if owners else None

        # Extra metadata stored in appProperties
        app_props: dict = meta.get("appProperties") or {}
        extra_meta: dict = {}
        if "lifelike_meta" in app_props:
            try:
                extra_meta = json.loads(app_props["lifelike_meta"])
            except (ValueError, TypeError):
                pass

        return FileStat(
            path=path,
            size=int(meta.get("size", 0) or 0),
            content_type=meta.get("mimeType"),
            created_at=meta.get("createdTime"),
            modified_at=meta.get("modifiedTime"),
            mode=mode,
            owner=owner_email,
            extra={
                "name": meta.get("name"),
                "drive_permissions": meta.get("permissions", []),
                **extra_meta,
            },
        )

    # ------------------------------------------------------------------
    # ACL operations
    # ------------------------------------------------------------------

    def chmod(self, path: str, mode: int) -> None:
        """Map *mode* to a Drive permission role and update the file.

        The method locates the first non-owner ``user`` or ``anyone``
        permission on the file and updates its role.  If no such permission
        exists, a new ``anyone`` permission is created with the mapped role.
        """
        meta = self._get_file_meta(path)
        target_role = _mode_to_role(mode)

        # Find the first non-owner permission to update.
        permissions = meta.get("permissions", [])
        target_perm = next(
            (p for p in permissions if p.get("role") not in ("owner", "organizer")),
            None,
        )

        if target_perm:
            self._service.permissions().update(
                fileId=path,
                permissionId=target_perm["id"],
                body={"role": target_role},
                fields="id,role",
            ).execute()
        else:
            # Create a new "anyone" permission with the target role.
            self._service.permissions().create(
                fileId=path,
                body={"type": "anyone", "role": target_role},
                fields="id,role",
            ).execute()

    def chown(self, path: str, uid: str, gid: str) -> None:
        """Transfer ownership of the file to *uid* (an e-mail address).

        *gid* is accepted for API compatibility but is ignored, as Drive does
        not have a group concept equivalent to POSIX groups.  Ownership
        transfer requires the ``drive`` scope and may need domain-wide
        delegation for Workspace accounts.
        """
        # Find current owner permission ID
        meta = self._get_file_meta(path)
        owner_perm = next(
            (p for p in meta.get("permissions", []) if p.get("role") == "owner"),
            None,
        )

        if owner_perm:
            self._service.permissions().update(
                fileId=path,
                permissionId=owner_perm["id"],
                body={"role": "writer"},
                transferOwnership=False,
                fields="id,role",
            ).execute()

        # Create new owner permission
        self._service.permissions().create(
            fileId=path,
            body={"type": "user", "role": "owner", "emailAddress": uid},
            transferOwnership=True,
            fields="id,role",
        ).execute()

    # ------------------------------------------------------------------
    # History / versioning (Drive Revisions API)
    # ------------------------------------------------------------------

    def list_revisions(self, path: str) -> List[Revision]:
        """List all Drive revisions for *path* (file ID), newest first."""
        response = (
            self._service.revisions()
            .list(
                fileId=path,
                fields=(
                    "revisions(id,modifiedTime,lastModifyingUser,size,keepForever)"
                ),
            )
            .execute()
        )
        revisions = []
        for rev in reversed(response.get("revisions", [])):
            user_info = rev.get("lastModifyingUser") or {}
            revisions.append(
                Revision(
                    rev_id=rev["id"],
                    path=path,
                    created_at=rev.get("modifiedTime"),
                    author=user_info.get("emailAddress") or user_info.get("displayName"),
                    size=int(rev["size"]) if rev.get("size") else None,
                    extra={"keepForever": rev.get("keepForever", False)},
                )
            )
        return revisions

    def get_revision_stream(self, path: str, rev_id: str) -> BinaryIO:
        """Download the content of revision *rev_id* as a binary stream."""
        response = (
            self._service.revisions()
            .get_media(fileId=path, revisionId=rev_id)
            .execute()
        )
        if isinstance(response, bytes):
            return io.BytesIO(response)
        return io.BytesIO(response.read() if hasattr(response, "read") else b"")

    def restore_revision(self, path: str, rev_id: str) -> None:
        """Restore *path* to revision *rev_id* by re-uploading its content.

        A new Drive revision is created that is identical to the requested
        historical one, preserving the full revision history.
        """
        stream = self.get_revision_stream(path, rev_id)
        # Re-upload using the Media upload endpoint (multipart).
        try:
            from googleapiclient.http import MediaIoBaseUpload
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "google-api-python-client is required for restore_revision"
            ) from exc

        # Determine MIME type from current file metadata.
        meta = self._get_file_meta(path)
        mime_type = meta.get("mimeType", "application/octet-stream")

        media = MediaIoBaseUpload(stream, mimetype=mime_type, resumable=False)
        self._service.files().update(fileId=path, media_body=media).execute()

    # ------------------------------------------------------------------
    # IO
    # ------------------------------------------------------------------

    def open_read(self, path: str) -> BinaryIO:
        """Download the current content of *path* as a binary stream."""
        response = self._service.files().get_media(fileId=path).execute()
        if isinstance(response, bytes):
            return io.BytesIO(response)
        return io.BytesIO(response.read() if hasattr(response, "read") else b"")

    def open_write(
        self,
        path: str,
        stream: BinaryIO,
        *,
        size: Optional[int] = None,
        author: Optional[str] = None,
    ) -> bool:
        """Upload *stream* to *path*, replacing the current content and
        creating a new Drive revision.
        """
        try:
            from googleapiclient.http import MediaIoBaseUpload
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "google-api-python-client is required for open_write"
            ) from exc

        meta = self._get_file_meta(path)
        mime_type = meta.get("mimeType", "application/octet-stream")
        media = MediaIoBaseUpload(stream, mimetype=mime_type, resumable=False)
        self._service.files().update(fileId=path, media_body=media).execute()
        return True
