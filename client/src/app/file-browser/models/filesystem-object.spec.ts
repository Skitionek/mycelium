import { getLanguageExtension } from 'app/codemirror-viewer/codemirror-language';
import { isCodemirrorHandledMimeType } from 'app/shared/constants';

import { FilesystemObject } from './filesystem-object';

function file(filename: string, mimeType: string): FilesystemObject {
  return new FilesystemObject().update({
    hashId: 'hash-id',
    filename,
    mimeType,
    project: {name: 'project'},
  });
}

describe('FilesystemObject', () => {
  describe('documents LibreOffice converts to PDF', () => {
    // Uploads often arrive as application/octet-stream, so the extension
    // alone has to be enough to open them in the PDF viewer.
    for (const filename of ['report.docx', 'sheet.XLSX', 'slides.odp', 'old.doc']) {
      it(`should open ${filename} without a recognised MIME type in the PDF viewer`, () => {
        const object = file(filename, 'application/octet-stream');

        expect(object.isLibreOfficeConvertible).toBe(true);
        expect(object.isOpenable).toBe(true);
        expect(object.getCommands()).toEqual(['/projects', 'project', 'files', 'hash-id']);
      });
    }

    it('should recognise an Office MIME type whatever the filename', () => {
      const object = file('download', 'application/vnd.ms-excel');

      expect(object.isLibreOfficeConvertible).toBe(true);
    });

    it('should not treat other binaries as convertible', () => {
      const object = file('archive.bin', 'application/octet-stream');

      expect(object.isLibreOfficeConvertible).toBe(false);
      expect(object.isOpenable).toBe(false);
      expect(object.getCommands()).toEqual(['/files', 'hash-id']);
    });
  });

  describe('text and code files', () => {
    for (const mimeType of ['text/x-python', 'text/x-script.python', 'TEXT/X-PYTHON', 'application/json']) {
      it(`should open ${mimeType} in the code viewer`, () => {
        const object = file('script', mimeType);

        expect(object.isOpenable).toBe(true);
        expect(object.getCommands()).toEqual(['/projects', 'project', 'code', 'hash-id']);
      });
    }

    it('should prefer the code viewer for text LibreOffice could also convert', () => {
      expect(file('notes.txt', 'text/plain').getCommands())
        .toEqual(['/projects', 'project', 'code', 'hash-id']);
    });
  });
});

describe('isCodemirrorHandledMimeType', () => {
  it('should ignore case and accept any python MIME type', () => {
    expect(isCodemirrorHandledMimeType('Text/Markdown')).toBe(true);
    expect(isCodemirrorHandledMimeType('text/x-python3')).toBe(true);
  });

  it('should reject missing and binary MIME types', () => {
    expect(isCodemirrorHandledMimeType(undefined)).toBe(false);
    expect(isCodemirrorHandledMimeType('application/pdf')).toBe(false);
  });
});

describe('getLanguageExtension', () => {
  it('should pick a language whatever the MIME type case', () => {
    expect(getLanguageExtension('TEXT/X-PYTHON')).not.toBeNull();
    expect(getLanguageExtension('Application/JSON')).not.toBeNull();
  });

  it('should fall back to plain text', () => {
    expect(getLanguageExtension('text/plain')).toBeNull();
    expect(getLanguageExtension(undefined)).toBeNull();
  });
});
