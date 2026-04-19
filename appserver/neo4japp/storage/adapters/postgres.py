"""
PostgresAdapter — wraps the existing Lifelike Postgres/SQLAlchemy file storage.

Capabilities
------------
* ``supports_acl``        = ``True``  — the Lifelike Postgres store carries
  sufficient ACL information to satisfy the interface:

  - ``file.public`` (boolean) maps to the POSIX *other-read* bit (``o+r``).
  - ``file.user_id`` represents the file owner.
  - ``chmod`` reads/writes ``file.public`` from/to the ``o+r`` bit.
  - ``chown`` transfers ownership by changing ``file.user_id``; *uid* must be
    the ``hash_id`` of an :class:`~neo4japp.models.auth.AppUser` row.  *gid*
    is accepted for API compatibility but is a no-op (Lifelike has no group
    concept at the file level).

* ``supports_versioning`` = ``True``  — revisions are stored in the
  ``file_version`` table via :class:`~neo4japp.models.files.FileVersion`.

POSIX mode convention
---------------------
The Lifelike ACL model is simpler than a full POSIX grid, so the mapping is:

==========  =======  ================================================
POSIX bits  Value    Lifelike meaning
==========  =======  ================================================
``u+rw``    0o600    Owner always has read/write (implicit via user_id)
``o+r``     0o004    ``file.public == True``
==========  =======  ================================================

``stat`` returns ``0o604`` for public files and ``0o600`` for private ones.
``chmod`` enables *public* when the *other-read* bit (``0o004``) is set in
*mode*, and disables it otherwise.  All other bits are ignored.
"""

from __future__ import annotations

import io
from typing import BinaryIO, List, Optional

from sqlalchemy.orm import joinedload

from neo4japp.database import db
from neo4japp.models.auth import AppUser
from neo4japp.models.files import FileContent, FileVersion, Files
from neo4japp.storage.interface import (
    FileStat,
    IStorageProvider,
    Revision,
    StorageCapabilities,
)

# Owner always has read/write; no execute bits are stored
_OWNER_BITS = 0o600


class PostgresAdapter(IStorageProvider):
    """Storage adapter backed by the Lifelike Postgres database.

    *path* is treated as the ``hash_id`` of a :class:`~neo4japp.models.files.Files`
    row throughout all methods.
    """

    _CAPABILITIES = StorageCapabilities(supports_acl=True, supports_versioning=True)

    # ------------------------------------------------------------------
    # Capabilities
    # ------------------------------------------------------------------

    @property
    def capabilities(self) -> StorageCapabilities:
        return self._CAPABILITIES

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_file(self, path: str) -> Files:
        """Resolve *path* (= ``hash_id``) to a :class:`Files` row.

        :raises FileNotFoundError: when no matching, non-deleted row exists.
        """
        file: Optional[Files] = (
            db.session.query(Files)
            .filter(Files.hash_id == path, Files.deletion_date.is_(None))
            .one_or_none()
        )
        if file is None:
            raise FileNotFoundError(f"File not found: {path!r}")
        return file

    def _get_file_version(self, path: str, rev_id: str) -> FileVersion:
        """Resolve (*path*, *rev_id*) to a :class:`FileVersion` row."""
        fv: Optional[FileVersion] = (
            db.session.query(FileVersion)
            .options(joinedload(FileVersion.content))
            .filter(
                FileVersion.hash_id == rev_id,
                FileVersion.deletion_date.is_(None),
            )
            .one_or_none()
        )
        if fv is None:
            raise FileNotFoundError(
                f"Revision {rev_id!r} not found for path {path!r}"
            )
        # Verify that the revision belongs to the file identified by *path*.
        file = self._get_file(path)
        if fv.file_id != file.id:
            raise FileNotFoundError(
                f"Revision {rev_id!r} does not belong to file {path!r}"
            )
        return fv

    @staticmethod
    def _mode_from_file(file: Files) -> int:
        """Derive a POSIX mode integer from *file*'s public flag."""
        mode = _OWNER_BITS
        if file.public:
            mode |= 0o004  # other-read
        return mode

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------

    def stat(self, path: str) -> FileStat:
        file = self._get_file(path)
        size = len(file.content.raw_file) if file.content else 0
        checksum = file.content.checksum_sha256.hex() if file.content else None
        return FileStat(
            path=path,
            size=size,
            content_type=file.mime_type,
            created_at=file.creation_date,
            modified_at=file.modified_date,
            mode=self._mode_from_file(file),
            owner=str(file.user_id) if file.user_id else None,
            checksum=checksum,
        )

    # ------------------------------------------------------------------
    # ACL operations
    # ------------------------------------------------------------------

    def chmod(self, path: str, mode: int) -> None:
        """Set the *public* flag on *path* from the other-read bit of *mode*.

        Setting ``o+r`` (bit ``0o004``) makes the file publicly readable.
        Clearing it restricts access to collaborators only.  All other mode
        bits are accepted but have no effect on the Postgres storage backend.

        :raises FileNotFoundError: if *path* does not exist.
        """
        file = self._get_file(path)
        file.public = bool(mode & 0o004)
        db.session.flush()

    def chown(self, path: str, uid: str, gid: str) -> None:
        """Transfer ownership of *path* to the user identified by *uid*.

        *uid* must be the ``hash_id`` of an existing
        :class:`~neo4japp.models.auth.AppUser` row.  *gid* is accepted for
        API compatibility but is a no-op — Lifelike has no group concept at
        the file level.

        :raises FileNotFoundError: if *path* or the user identified by *uid*
            does not exist.
        """
        file = self._get_file(path)
        new_owner: Optional[AppUser] = (
            db.session.query(AppUser)
            .filter(AppUser.hash_id == uid)
            .one_or_none()
        )
        if new_owner is None:
            raise FileNotFoundError(f"User not found: {uid!r}")
        file.user_id = new_owner.id
        db.session.flush()

    # ------------------------------------------------------------------
    # History / versioning
    # ------------------------------------------------------------------

    def list_revisions(self, path: str) -> List[Revision]:
        """Return all non-deleted revisions for the file identified by *path*
        (= ``hash_id``), ordered newest-first."""
        file = self._get_file(path)
        rows: List[FileVersion] = (
            db.session.query(FileVersion)
            .options(joinedload(FileVersion.content), joinedload(FileVersion.user))
            .filter(
                FileVersion.file_id == file.id,
                FileVersion.deletion_date.is_(None),
            )
            .order_by(FileVersion.creation_date.desc())
            .all()
        )
        revisions = []
        for fv in rows:
            size = len(fv.content.raw_file) if fv.content else None
            author = fv.user.username if fv.user else str(fv.user_id)
            revisions.append(
                Revision(
                    rev_id=fv.hash_id,
                    path=path,
                    created_at=fv.creation_date,
                    author=author,
                    message=fv.message,
                    size=size,
                )
            )
        return revisions

    def get_revision_stream(self, path: str, rev_id: str) -> BinaryIO:
        """Return a :class:`io.BytesIO` stream for the requested revision."""
        fv = self._get_file_version(path, rev_id)
        if fv.content is None:
            raise FileNotFoundError(
                f"Content missing for revision {rev_id!r} of {path!r}"
            )
        return io.BytesIO(fv.content.raw_file)

    def restore_revision(self, path: str, rev_id: str) -> None:
        """Restore *path* to the content of *rev_id*.

        The current file content is saved as a new :class:`FileVersion` before
        the restore, preserving the full audit trail.
        """
        file = self._get_file(path)
        target_fv = self._get_file_version(path, rev_id)

        if file.content_id == target_fv.content_id:
            # Nothing to do — content is already identical.
            return

        # Snapshot current state as a new revision entry.
        if file.content_id is not None:
            snapshot = FileVersion()
            snapshot.file = file
            snapshot.content_id = file.content_id
            snapshot.user_id = file.user_id
            snapshot.message = f"auto-snapshot before restoring revision {rev_id}"
            db.session.add(snapshot)

        file.content_id = target_fv.content_id
        db.session.flush()

    # ------------------------------------------------------------------
    # IO
    # ------------------------------------------------------------------

    def open_read(self, path: str) -> BinaryIO:
        """Return a :class:`io.BytesIO` stream for the current file content."""
        file = self._get_file(path)
        if file.content is None:
            raise FileNotFoundError(f"File {path!r} has no content")
        return io.BytesIO(file.content.raw_file)

    def open_write(
        self,
        path: str,
        stream: BinaryIO,
        *,
        size: Optional[int] = None,
        author: Optional[str] = None,
    ) -> bool:
        """Replace the content of *path* with *stream*.

        The previous content is saved as a :class:`FileVersion` if it differs
        from the new content, so that history is preserved.

        :param author: ``hash_id`` of the :class:`AppUser` who performed the
            write, stored on the new :class:`FileVersion` record.  When
            omitted, the file's current owner is used.
        :returns: ``True`` if the content changed, ``False`` if the new
            content is byte-for-byte identical to the current content.
        """
        file = self._get_file(path)
        new_content_id = FileContent.get_or_create(stream)

        if file.content_id == new_content_id:
            return False

        if file.content_id is not None:
            version = FileVersion()
            version.file = file
            version.content_id = file.content_id
            if author is not None:
                # Resolve author hash_id to a user_id
                user: Optional[AppUser] = (
                    db.session.query(AppUser)
                    .filter(AppUser.hash_id == author)
                    .one_or_none()
                )
                version.user_id = user.id if user is not None else file.user_id
            else:
                version.user_id = file.user_id
            db.session.add(version)

        file.content_id = new_content_id
        db.session.flush()
        return True
