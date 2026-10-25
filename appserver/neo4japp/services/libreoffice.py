"""
Service for converting files to PDF using LibreOffice (soffice).

LibreOffice must be installed in the runtime environment for this service
to function. If LibreOffice is not available, a RuntimeError is raised.
"""

import os
import shutil
import subprocess
import tempfile
from io import BytesIO, BufferedIOBase
from pathlib import Path
from typing import Optional


# Extension mapping for MIME types that LibreOffice can convert to PDF.
# Used to determine the file extension when writing the input to a temp file.
_MIME_TO_EXTENSION: dict[str, str] = {
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.oasis.opendocument.text': '.odt',
    'application/vnd.oasis.opendocument.spreadsheet': '.ods',
    'application/vnd.oasis.opendocument.presentation': '.odp',
    'text/rtf': '.rtf',
    'application/rtf': '.rtf',
    'text/plain': '.txt',
    'text/html': '.html',
    'text/csv': '.csv',
}


def mime_type_for_filename(filename: str) -> Optional[str]:
    """The convertible MIME type matching a file name's extension, if any."""
    extension = os.path.splitext(filename or '')[1].lower()
    for mime_type, mime_extension in _MIME_TO_EXTENSION.items():
        if mime_extension == extension:
            return mime_type
    return None


def _find_soffice() -> str:
    """Return the path to the soffice / libreoffice binary, or raise RuntimeError."""
    for candidate in ('soffice', 'libreoffice'):
        path = shutil.which(candidate)
        if path:
            return path
    raise RuntimeError(
        'LibreOffice is not installed or not on PATH. '
        'Install it (e.g. apt-get install -y libreoffice) to enable file-to-PDF conversion.'
    )


def convert_to_pdf(content: bytes, mime_type: str) -> BufferedIOBase:
    """
    Convert *content* (raw bytes of a file with the given *mime_type*) to PDF
    using LibreOffice running in headless mode.

    :param content: Raw bytes of the source file.
    :param mime_type: MIME type of the source file.
    :returns: A :class:`~io.BytesIO` buffer containing the generated PDF.
    :raises RuntimeError: If LibreOffice is not available.
    :raises ValueError: If the MIME type is not supported.
    :raises subprocess.CalledProcessError: If LibreOffice exits with a non-zero
        status code.
    """
    extension = _MIME_TO_EXTENSION.get(mime_type.lower())
    if extension is None:
        raise ValueError(f'MIME type {mime_type!r} is not supported for PDF conversion.')

    soffice = _find_soffice()

    with tempfile.TemporaryDirectory(prefix='mycelium_lo_') as tmpdir:
        # Write source file to a temp path so LibreOffice can read it.
        src_path = os.path.join(tmpdir, f'input{extension}')
        with open(src_path, 'wb') as fh:
            fh.write(content)

        # Run conversion; output PDF lands in the same temp directory. Each run gets
        # its own profile: runs sharing one collide, and all but the first exit
        # without converting anything.
        profile = Path(tmpdir, 'profile').as_uri()
        subprocess.run(
            [
                soffice,
                f'-env:UserInstallation={profile}',
                '--headless',
                '--norestore',
                '--nofirststartwizard',
                '--convert-to', 'pdf',
                '--outdir', tmpdir,
                src_path,
            ],
            check=True,
            timeout=120,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # LibreOffice names the output file after the input stem.
        pdf_path = os.path.join(tmpdir, 'input.pdf')
        if not os.path.exists(pdf_path):
            raise RuntimeError(
                f'LibreOffice did not produce a PDF at {pdf_path!r}. '
                'The conversion may have failed silently.'
            )

        with open(pdf_path, 'rb') as fh:
            return BytesIO(fh.read())
