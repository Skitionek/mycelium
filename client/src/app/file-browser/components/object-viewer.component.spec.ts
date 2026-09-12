import { of, throwError } from 'rxjs';

import { ObjectViewerComponent } from './object-viewer.component';
import { FilesystemObject } from '../models/filesystem-object';

describe('ObjectViewerComponent', () => {
  let component: ObjectViewerComponent;
  let filesystemService: any;
  let sanitizer: any;

  beforeEach(() => {
    filesystemService = {
      get: jasmine.createSpy('get'),
      getContent: jasmine.createSpy('getContent'),
    };
    sanitizer = {
      bypassSecurityTrustHtml: jasmine.createSpy('bypassSecurityTrustHtml')
        .and.callFake((html: string) => html),
    };
    const route = { params: of({}) } as any;
    const errorHandler = { create: () => (source$: any) => source$ } as any;
    const progressDialog = {} as any;

    component = new ObjectViewerComponent(route, errorHandler, filesystemService, progressDialog, sanitizer);
  });

  describe('resolveViewerType', () => {
    it('routes application/pdf mime type to the pdf viewer', () => {
      const object = { mimeType: 'application/pdf', filename: 'report.bin' } as FilesystemObject;
      expect((component as any).resolveViewerType(object)).toBe('pdf');
    });

    it('routes .docx filenames to the mammoth viewer', () => {
      const object = { mimeType: 'application/octet-stream', filename: 'notes.docx' } as FilesystemObject;
      expect((component as any).resolveViewerType(object)).toBe('mammoth');
    });

    for (const ext of ['.xlsx', '.xls', '.ods']) {
      it(`routes ${ext} filenames to the xlsx viewer`, () => {
        const object = { mimeType: 'application/octet-stream', filename: `sheet${ext}` } as FilesystemObject;
        expect((component as any).resolveViewerType(object)).toBe('xlsx');
      });
    }

    it('returns null for unsupported file types', () => {
      const object = { mimeType: 'application/zip', filename: 'archive.zip' } as FilesystemObject;
      expect((component as any).resolveViewerType(object)).toBeNull();
    });
  });

  describe('prepareInlineViewer', () => {
    it('creates an object URL for pdf content with the correct mime type', () => {
      const object = { hashId: 'abc', mimeType: 'application/pdf', filename: 'report.pdf' } as FilesystemObject;
      const blob = new Blob(['%PDF-1.4'], { type: 'application/octet-stream' });
      filesystemService.getContent.and.returnValue(of(blob));

      const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');

      (component as any).prepareInlineViewer(object);

      expect(component.viewerType).toBe('pdf');
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(component.objectUrl).toBe('blob:mock-url');
    });

    it('leaves viewerType null and does not fetch content for unsupported types', () => {
      const object = { hashId: 'abc', mimeType: 'application/zip', filename: 'archive.zip' } as FilesystemObject;

      (component as any).prepareInlineViewer(object);

      expect(component.viewerType).toBeNull();
      expect(filesystemService.getContent).not.toHaveBeenCalled();
    });

    it('falls back to no viewer and records the error when content fetch fails', () => {
      const object = { hashId: 'abc', mimeType: 'application/pdf', filename: 'report.pdf' } as FilesystemObject;
      const error = new Error('network error');
      filesystemService.getContent.and.returnValue(throwError(() => error));

      (component as any).prepareInlineViewer(object);

      expect(component.viewerType).toBeNull();
      expect(component.contentError).toBe(error);
    });
  });

  describe('xlsx sheet selection', () => {
    it('renders the first sheet and switches sheets via selectSheet', () => {
      const XLSX = require('xlsx');
      const workbook = XLSX.utils.book_new();
      const sheet1 = XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]);
      const sheet2 = XLSX.utils.aoa_to_sheet([['x', 'y'], [3, 4]]);
      XLSX.utils.book_append_sheet(workbook, sheet1, 'Sheet1');
      XLSX.utils.book_append_sheet(workbook, sheet2, 'Sheet2');

      (component as any).workbook = workbook;
      (component as any).sheetNames = workbook.SheetNames;
      (component as any).renderActiveSheet();

      expect(component.sheetNames).toEqual(['Sheet1', 'Sheet2']);
      expect(component.activeSheetIndex).toBe(0);
      expect(component.activeSheetHtml).toContain('a');

      component.selectSheet(1);

      expect(component.activeSheetIndex).toBe(1);
      expect(component.activeSheetHtml).toContain('x');
    });
  });
});
