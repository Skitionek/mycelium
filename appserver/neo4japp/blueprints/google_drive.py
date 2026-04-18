"""
Google Drive integration — index and sync only.

Files/folders are *indexed* (metadata stored in Lifelike's database) but their
content is never downloaded or copied here.  Google Drive remains the single
source of truth for file contents.

Endpoints
---------
POST /google-drive/import
    Index a Drive file or folder (recursively) under a Lifelike parent directory.

POST /google-drive/sync/<hash_id>
    Re-sync the metadata of a previously indexed Drive item (and its
    descendants if it is a directory) using a fresh access token.
"""

import os
from datetime import datetime, timezone
from typing import List, Optional

import requests as http_requests
from flask import Blueprint, g, jsonify
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.filesystem import FilesystemBaseView
from neo4japp.database import db
from neo4japp.models import Files
from neo4japp.schemas.google_drive import (
    GoogleDriveImportRequestSchema,
    GoogleDriveSyncRequestSchema,
)
from neo4japp.services.file_types.providers import DirectoryTypeProvider

GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
GOOGLE_DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
GOOGLE_DRIVE_SHORTCUT_MIME = 'application/vnd.google-apps.shortcut'

# Google-native MIME types that can be exported as PDF (kept for display label only)
GOOGLE_EXPORTABLE_MIME_TYPES = {
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/vnd.google-apps.drawing',
}

MAX_FOLDER_DEPTH = 10

bp = Blueprint('google_drive', __name__, url_prefix='/google-drive')


# ---------------------------------------------------------------------------
# Drive API helpers
# ---------------------------------------------------------------------------

def _drive_get(path_or_url: str, access_token: str, **kwargs) -> http_requests.Response:
    url = (path_or_url if path_or_url.startswith('http')
           else f'{GOOGLE_DRIVE_FILES_URL}/{path_or_url}')
    return http_requests.get(
        url,
        headers={'Authorization': f'Bearer {access_token}'},
        **kwargs,
    )


def _check_drive_errors(resp: http_requests.Response,
                        field: str = 'googleDriveFileId') -> None:
    if resp.status_code == 401:
        raise ValidationError(
            'The Google Drive access token is invalid or has expired. '
            'Please reconnect and try again.',
            'googleDriveAccessToken',
        )
    if resp.status_code == 403:
        raise ValidationError('Access to the selected Google Drive item was denied.', field)
    if resp.status_code == 404:
        raise ValidationError('The selected Google Drive item could not be found.', field)
    if not resp.ok:
        raise ValidationError(
            'An error occurred while communicating with Google Drive.', field)


def _get_drive_item_meta(item_id: str, access_token: str) -> dict:
    """Return ``{'id', 'name', 'mimeType', 'modifiedTime'}`` for a Drive item."""
    resp = _drive_get(
        item_id, access_token,
        params={'fields': 'id,name,mimeType,modifiedTime'},
        timeout=15,
    )
    _check_drive_errors(resp)
    return resp.json()


def _list_drive_folder(folder_id: str, access_token: str) -> List[dict]:
    """Return all direct (non-trashed) children of a Drive folder."""
    items: List[dict] = []
    page_token: Optional[str] = None
    while True:
        params = {
            'q': f"'{folder_id}' in parents and trashed = false",
            'fields': 'nextPageToken,files(id,name,mimeType,modifiedTime)',
            'pageSize': 1000,
        }
        if page_token:
            params['pageToken'] = page_token
        resp = _drive_get('', access_token, params=params, timeout=30)
        _check_drive_errors(resp)
        body = resp.json()
        items.extend(body.get('files', []))
        page_token = body.get('nextPageToken')
        if not page_token:
            break
    return items


def _parse_modified_time(value: Optional[str]) -> Optional[datetime]:
    """Parse a RFC-3339 Drive modifiedTime string to an aware datetime."""
    if not value:
        return None
    try:
        # Python 3.7+ understands the Z suffix via fromisoformat only in 3.11+
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Lifelike record helpers (index-only, no content download)
# ---------------------------------------------------------------------------

def _persist_file(file: Files) -> None:
    """Commit *file* to the database with conflict-safe filename handling."""
    for trial in range(4):
        if 1 <= trial <= 2:
            try:
                file.filename = file.generate_non_conflicting_filename()
            except ValueError:
                raise ValidationError(
                    'Filename conflicts with an existing file in the same folder.',
                    'filename',
                )
        elif trial == 3:
            raise ValidationError(
                'Filename conflicts with an existing file in the same folder.',
                'filename',
            )
        try:
            db.session.begin_nested()
            db.session.add(file)
            db.session.commit()
            break
        except IntegrityError:
            db.session.rollback()


def _create_index_record(
    *,
    item_id: str,
    item_name: str,
    mime_type: str,
    modified_time: Optional[datetime],
    parent: Files,
    user,
    public: bool,
    description: str = '',
    fallback_organism=None,
    annotation_configs=None,
) -> Files:
    """Create a *metadata-only* Files record that points to a Drive item."""
    file = Files()
    file.filename = item_name
    file.description = description
    file.mime_type = mime_type
    file.user = user
    file.creator = user
    file.modifier = user
    file.public = public
    file.parent = parent
    file.content_id = None  # no content stored locally
    file.google_drive_id = item_id
    file.google_drive_modified_time = modified_time
    file.upload_url = (
        f'https://drive.google.com/drive/folders/{item_id}'
        if mime_type == GOOGLE_DRIVE_FOLDER_MIME
        else f'https://drive.google.com/file/d/{item_id}/view'
    )
    if fallback_organism:
        db.session.add(fallback_organism)
        file.fallback_organism = fallback_organism
    if annotation_configs:
        file.annotation_configs = annotation_configs
    _persist_file(file)
    return file


def _index_drive_folder_recursive(
    folder_id: str,
    folder_name: str,
    access_token: str,
    parent: Files,
    user,
    public: bool,
    fallback_organism,
    annotation_configs,
    depth: int = 0,
) -> Files:
    """Recursively index a Drive folder as a Lifelike directory tree."""
    if depth > MAX_FOLDER_DEPTH:
        raise ValidationError(
            f'Google Drive folder hierarchy is too deep (max {MAX_FOLDER_DEPTH} levels).',
            'googleDriveFileId',
        )

    # Create the root directory record first so children can reference it
    directory = _create_index_record(
        item_id=folder_id,
        item_name=folder_name,
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        modified_time=None,
        parent=parent,
        user=user,
        public=public,
        fallback_organism=fallback_organism,
        annotation_configs=annotation_configs,
    )

    for child in _list_drive_folder(folder_id, access_token):
        child_mime = child.get('mimeType', '')
        if child_mime == GOOGLE_DRIVE_SHORTCUT_MIME:
            continue  # skip shortcuts to avoid re-importing
        modified = _parse_modified_time(child.get('modifiedTime'))
        if child_mime == GOOGLE_DRIVE_FOLDER_MIME:
            _index_drive_folder_recursive(
                child['id'], child['name'],
                access_token, directory, user, public,
                fallback_organism, annotation_configs,
                depth=depth + 1,
            )
        else:
            _create_index_record(
                item_id=child['id'],
                item_name=child['name'],
                mime_type=child_mime,
                modified_time=modified,
                parent=directory,
                user=user,
                public=public,
            )

    db.session.commit()
    return directory


# ---------------------------------------------------------------------------
# Sync helpers
# ---------------------------------------------------------------------------

def _sync_file_record(file: Files, meta: dict) -> bool:
    """Update *file* metadata from Drive API *meta* if it has changed.

    Returns ``True`` when at least one field was updated.
    """
    changed = False
    new_name = meta.get('name', file.filename)
    new_mime = meta.get('mimeType', file.mime_type)
    new_mod = _parse_modified_time(meta.get('modifiedTime'))

    if file.filename != new_name:
        file.filename = new_name
        changed = True
    if file.mime_type != new_mime:
        file.mime_type = new_mime
        changed = True
    if new_mod and file.google_drive_modified_time != new_mod:
        file.google_drive_modified_time = new_mod
        changed = True

    if changed:
        db.session.add(file)
    return changed


def _sync_tree(file: Files, access_token: str, depth: int = 0) -> int:
    """Recursively sync *file* and all Drive-indexed descendants.

    Returns the number of records updated.
    """
    if not file.google_drive_id:
        return 0
    if depth > MAX_FOLDER_DEPTH:
        return 0

    meta = _get_drive_item_meta(file.google_drive_id, access_token)
    updates = 1 if _sync_file_record(file, meta) else 0

    # Sync children that are also Drive-indexed
    if file.mime_type == DirectoryTypeProvider.MIME_TYPE:
        children = (
            db.session.query(Files)
            .filter(
                Files.parent_id == file.id,
                Files.deletion_date.is_(None),
                Files.google_drive_id.isnot(None),
            )
            .all()
        )
        for child in children:
            updates += _sync_tree(child, access_token, depth=depth + 1)

    db.session.commit()
    return updates


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

class GoogleDriveImportView(FilesystemBaseView):
    """Index a Drive file *or* folder (recursively) under a Lifelike parent.

    No file content is downloaded or stored — Google Drive remains the
    source of truth.  Only metadata (name, MIME type, Drive ID, last
    modified timestamp) is persisted in Lifelike.
    """

    decorators = [auth.login_required]

    @use_args(GoogleDriveImportRequestSchema, location='json')
    def post(self, params: dict):
        from neo4japp.exceptions import RecordNotFound

        current_user = g.current_user
        item_id = params['google_drive_file_id']
        access_token = params['google_drive_access_token']

        meta = _get_drive_item_meta(item_id, access_token)
        drive_mime = meta.get('mimeType', '')
        drive_name = meta.get('name', 'untitled')
        drive_modified = _parse_modified_time(meta.get('modifiedTime'))

        # Resolve parent
        try:
            parent = self.get_nondeleted_recycled_file(
                Files.hash_id == params['parent_hash_id']
            )
        except RecordNotFound:
            raise ValidationError(
                'The requested parent folder could not be found.',
                'parentHashId',
            )
        self.check_file_permissions([parent], current_user, ['writable'], permit_recycled=False)
        if parent.mime_type != DirectoryTypeProvider.MIME_TYPE:
            raise ValidationError(
                f'The specified parent ({params["parent_hash_id"]}) is not a folder.',
                'parentHashId',
            )

        override_name = params.get('filename') or None
        public = params.get('public', False)
        fallback_organism = params.get('fallback_organism')
        annotation_configs = params.get('annotation_configs')

        # Folder → create a directory hierarchy
        if drive_mime == GOOGLE_DRIVE_FOLDER_MIME:
            root = _index_drive_folder_recursive(
                item_id,
                override_name or drive_name,
                access_token,
                parent,
                current_user,
                public,
                fallback_organism,
                annotation_configs,
            )
            return self.get_file_response(root.hash_id, current_user)

        # Single file → create one index record
        record = _create_index_record(
            item_id=item_id,
            item_name=override_name or drive_name,
            mime_type=drive_mime,
            modified_time=drive_modified,
            parent=parent,
            user=current_user,
            public=public,
            description=params.get('description', ''),
            fallback_organism=fallback_organism,
            annotation_configs=annotation_configs,
        )
        db.session.commit()
        return self.get_file_response(record.hash_id, current_user)


class GoogleDriveSyncView(FilesystemBaseView):
    """Re-sync the metadata of a Drive-indexed Lifelike item.

    The caller supplies their current Drive access token; the endpoint
    fetches up-to-date metadata from the Drive API and updates the local
    index (filename, MIME type, last-modified time).  For directories the
    sync descends into all Drive-indexed children.
    """

    decorators = [auth.login_required]

    @use_args(GoogleDriveSyncRequestSchema, location='json')
    def post(self, params: dict, hash_id: str):
        from neo4japp.exceptions import RecordNotFound

        current_user = g.current_user
        access_token = params['google_drive_access_token']

        try:
            file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        except RecordNotFound:
            raise ValidationError('The requested item could not be found.', 'hashId')

        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=False)

        if not file.google_drive_id:
            raise ValidationError(
                'This item is not linked to Google Drive and cannot be synced.',
                'hashId',
            )

        updates = _sync_tree(file, access_token)
        return jsonify({'updatedCount': updates})


bp.add_url_rule('/import', view_func=GoogleDriveImportView.as_view('google_drive_import'))
bp.add_url_rule(
    '/sync/<hash_id>',
    view_func=GoogleDriveSyncView.as_view('google_drive_sync'),
)
