"""Converting office documents to PDF with LibreOffice."""
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import pytest

from neo4japp.services import libreoffice
from neo4japp.services.libreoffice import convert_to_pdf, mime_type_for_filename


@pytest.mark.parametrize('filename, mime_type', [
    ('report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ('REPORT.DOCX', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ('notes.txt', 'text/plain'),
    ('data.csv', 'text/csv'),
    ('paper.pdf', None),
    ('no-extension', None),
    ('', None),
    (None, None),
])
def test_mime_type_for_filename(filename, mime_type):
    assert mime_type_for_filename(filename) == mime_type


def test_rejects_an_unsupported_mime_type():
    with pytest.raises(ValueError):
        convert_to_pdf(b'%PDF-1.4', 'application/pdf')


def fake_soffice(command, **kwargs):
    """Write the PDF LibreOffice would, and keep the command for inspection."""
    fake_soffice.command = command
    outdir = Path(command[command.index('--outdir') + 1])
    (outdir / 'input.pdf').write_bytes(b'%PDF-fake')
    return subprocess.CompletedProcess(command, 0)


def test_each_conversion_uses_its_own_profile():
    """soffice runs sharing one profile collide: the second exits without a PDF."""
    with patch.object(libreoffice.shutil, 'which', return_value='/usr/bin/soffice'), \
            patch.object(libreoffice.subprocess, 'run', side_effect=fake_soffice):
        assert convert_to_pdf(b'text', 'text/plain').read() == b'%PDF-fake'

    command = fake_soffice.command
    outdir = Path(command[command.index('--outdir') + 1])
    profiles = [arg for arg in command if arg.startswith('-env:UserInstallation=')]
    assert len(profiles) == 1
    profile = profiles[0].split('=', 1)[1]
    assert profile == (outdir / 'profile').as_uri()


@pytest.mark.skipif(shutil.which('soffice') is None, reason='LibreOffice is not installed')
def test_concurrent_conversions_all_succeed():
    def convert(i):
        return convert_to_pdf(f'document {i}\n'.encode(), 'text/plain').read()

    with ThreadPoolExecutor(4) as pool:
        pdfs = list(pool.map(convert, range(4)))

    assert all(pdf.startswith(b'%PDF-') for pdf in pdfs)
