import io
import os

import requests as http_requests
from flask import Blueprint, g, jsonify
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.filesystem import FilesystemBaseView
from neo4japp.database import db, get_file_type_service
from neo4japp.models import Files, FileContent
from neo4japp.schemas.filesystem import FileResponseSchema
from neo4japp.schemas.google_drive import GoogleDriveImportRequestSchema
from neo4japp.services.file_types.providers import (
    BiocTypeProvider,
    DirectoryTypeProvider,
    EnrichmentTableTypeProvider,
    PDFTypeProvider,
)

GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'

# Google-native MIME types that can be exported as PDF
GOOGLE_EXPORTABLE_MIME_TYPES = {
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/vnd.google-apps.drawing',
}

bp = Blueprint('google_drive', __name__, url_prefix='/google-drive')


def _fetch_drive_file(file_id: str, access_token: str, max_size: int) -> tuple:
    """Download a file's content from Google Drive.

    For native Google documents (Docs, Sheets, Slides, Drawings) the file is
    exported as PDF.  All other files are downloaded as-is.

    Returns a ``(buffer, filename, mime_type)`` tuple where *buffer* is a
    rewound :class:`io.BytesIO` containing the raw file bytes.

    Raises :class:`~marshmallow.ValidationError` when the file cannot be
    retrieved or is too large.
    """
    auth_headers = {'Authorization': f'Bearer {access_token}'}

    # Fetch file metadata (name + mimeType)
    meta_resp = http_requests.get(
        f'{GOOGLE_DRIVE_FILES_URL}/{file_id}',
        params={'fields': 'name,mimeType'},
        headers=auth_headers,
        timeout=15,
    )
    if meta_resp.status_code == 401:
        raise ValidationError(
            'The Google Drive access token is invalid or has expired. '
            'Please reconnect and try again.',
            'googleDriveAccessToken',
        )
    if meta_resp.status_code == 403:
        raise ValidationError(
            'Access to the selected Google Drive file was denied.',
            'googleDriveFileId',
        )
    if meta_resp.status_code == 404:
        raise ValidationError(
            'The selected Google Drive file could not be found.',
            'googleDriveFileId',
        )
    if not meta_resp.ok:
        raise ValidationError(
            'An error occurred while retrieving the Google Drive file metadata.',
            'googleDriveFileId',
        )

    meta = meta_resp.json()
    drive_mime = meta.get('mimeType', '')
    drive_name = meta.get('name', 'untitled')

    # Choose the right download URL
    if drive_mime in GOOGLE_EXPORTABLE_MIME_TYPES:
        download_url = f'{GOOGLE_DRIVE_FILES_URL}/{file_id}/export'
        download_params = {'mimeType': 'application/pdf'}
        effective_mime = 'application/pdf'
        effective_name = os.path.splitext(drive_name)[0] + '.pdf'
    else:
        download_url = f'{GOOGLE_DRIVE_FILES_URL}/{file_id}'
        download_params = {'alt': 'media'}
        effective_mime = drive_mime
        effective_name = drive_name

    # Stream the file content while enforcing the size limit
    download_resp = http_requests.get(
        download_url,
        params=download_params,
        headers=auth_headers,
        stream=True,
        timeout=60,
    )
    if not download_resp.ok:
        raise ValidationError(
            'An error occurred while downloading the Google Drive file.',
            'googleDriveFileId',
        )

    # Check Content-Length header first
    content_length = download_resp.headers.get('Content-Length')
    if content_length is not None:
        try:
            if int(content_length) > max_size:
                raise ValidationError(
                    'The selected Google Drive file is too large to import.',
                    'googleDriveFileId',
                )
        except ValueError:
            pass

    buffer = io.BytesIO()
    downloaded = 0
    for chunk in download_resp.iter_content(chunk_size=8192):
        downloaded += len(chunk)
        if downloaded > max_size:
            raise ValidationError(
                'The selected Google Drive file is too large to import.',
                'googleDriveFileId',
            )
        buffer.write(chunk)

    buffer.seek(0)
    return buffer, effective_name, effective_mime


class GoogleDriveImportView(FilesystemBaseView):
    """Import a file from Google Drive into the Lifelike filesystem."""

    decorators = [auth.login_required]

    @use_args(GoogleDriveImportRequestSchema, location='json')
    def post(self, params: dict):
        current_user = g.current_user
        file_type_service = get_file_type_service()

        file_id = params['google_drive_file_id']
        access_token = params['google_drive_access_token']

        # ------------------------------------------------------------------
        # Download the file from Google Drive
        # ------------------------------------------------------------------
        buffer, drive_name, drive_mime = _fetch_drive_file(
            file_id, access_token, self.file_max_size
        )

        # ------------------------------------------------------------------
        # Resolve parent directory
        # ------------------------------------------------------------------
        from neo4japp.exceptions import RecordNotFound

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

        # ------------------------------------------------------------------
        # Build the file record
        # ------------------------------------------------------------------
        file = Files()
        file.filename = params.get('filename') or drive_name
        file.description = params.get('description', '')
        file.user = current_user
        file.creator = current_user
        file.modifier = current_user
        file.public = params.get('public', False)
        file.parent = parent

        # Determine MIME type
        mime_type = params.get('mime_type') or drive_mime
        if not mime_type:
            mime_type = file_type_service.detect_mime_type(buffer)
            buffer.seek(0)
        file.mime_type = mime_type

        # Convert BiocXML → BiocJSON if needed
        provider = file_type_service.get(file)
        if isinstance(provider, BiocTypeProvider):
            provider.convert(buffer)
            name_part, ext = os.path.splitext(file.filename)
            if ext.lower() != '.bioc':
                file.filename = name_part + '.bioc'

        if not provider.can_create():
            raise ValidationError('The file type from Google Drive is not accepted.')

        try:
            provider.validate_content(buffer)
            buffer.seek(0)
        except ValueError as exc:
            raise ValidationError(
                f'The Google Drive file may be corrupt: {exc}'
            )

        file.doi = provider.extract_doi(buffer)
        buffer.seek(0)

        # Store the Google Drive source URL so it is visible in the UI
        file.upload_url = f'https://drive.google.com/file/d/{file_id}/view'

        # Save content
        buffer.seek(0, io.SEEK_END)
        size = buffer.tell()
        buffer.seek(0)
        if size > self.file_max_size:
            raise ValidationError('The Google Drive file is too large to import.')
        if size:
            file.content_id = FileContent.get_or_create(buffer)
            buffer.seek(0)

        # Mark annotatable files for re-annotation
        if file.mime_type in (PDFTypeProvider.MIME_TYPE, EnrichmentTableTypeProvider.MIME_TYPE):
            file.needs_reannotation = True

        if params.get('fallback_organism'):
            db.session.add(params['fallback_organism'])
            file.fallback_organism = params['fallback_organism']

        if params.get('annotation_configs'):
            file.annotation_configs = params['annotation_configs']

        # ------------------------------------------------------------------
        # Persist (with filename-conflict resolution)
        # ------------------------------------------------------------------
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

        db.session.commit()

        # ------------------------------------------------------------------
        # Return the new file in the standard format
        # ------------------------------------------------------------------
        return self.get_file_response(file.hash_id, current_user)


bp.add_url_rule('/import', view_func=GoogleDriveImportView.as_view('google_drive_import'))
