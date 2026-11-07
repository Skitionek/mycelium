import { TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';

import { firstValueFrom, of, throwError } from 'rxjs';

import { MimeTypes } from 'app/shared/constants';
import { OfficeConverterService } from 'app/shared/services/office-converter.service';

import { encodeLocalHashId } from '../local-ids';
import { LocalFolderError } from '../local-folder-errors';
import { MemoryDirectoryHandle, MemoryFileHandle } from '../testing/memory-filesystem.spec';
import { configureLocalFolderTestBed, waitFor } from '../testing/local-folder-test-utils.spec';
import { LocalFolderRegistry, LocalRoot } from './local-folder-registry.service';
import { LocalFilesystemService } from './local-filesystem.service';

describe('LocalFilesystemService', () => {
  let service: LocalFilesystemService;
  let folder: MemoryDirectoryHandle;
  let root: LocalRoot;
  const id = (path: string) => encodeLocalHashId(root.id, path);

  beforeEach(async () => {
    configureLocalFolderTestBed();
    service = TestBed.inject(LocalFilesystemService);
    folder = new MemoryDirectoryHandle('Lab');
    folder.file('paper.pdf', '%PDF-1.7 ...');
    folder.file('notes.txt', 'hello');
    folder.file('.DS_Store', 'junk');
    folder.file('.annotations', '{"inherit": true}');
    folder.dir('Results').file('plan.json', '{"dmp": {"title": "Plan"}}');
    root = await TestBed.inject(LocalFolderRegistry).connect(folder);
  });

  it('lists a connected folder like a project root', async () => {
    const object = await firstValueFrom(service.get(id('')));
    expect(object.isDirectory).toBe(true);
    expect(object.isLocal).toBe(true);
    expect(object.parent).toBeNull();
    expect(object.project.name).toBe('Lab');
    expect(object.privileges.writable).toBe(true);
    // Hidden files, including the index, are not shown; the folder config is
    expect(object.children.items.map(child => child.filename).sort())
      .toEqual(['.annotations', 'Results', 'notes.txt', 'paper.pdf']);
  });

  it('opens files with the viewer route their type gets on the server', async () => {
    const pdf = await firstValueFrom(service.get(id('paper.pdf')));
    expect(pdf.mimeType).toBe(MimeTypes.Pdf);
    expect(pdf.getCommands()).toEqual(['/projects', 'Lab', 'files', id('paper.pdf')]);
    expect(pdf.parent.hashId).toBe(id(''));

    const plan = await firstValueFrom(service.get(id('Results/plan.json')));
    expect(plan.mimeType).toBe(MimeTypes.Dmp);
    expect(plan.parent.filename).toBe('Results');
    expect(plan.parent.parent.filename).toBe('Lab');
    expect(plan.isEditable).toBe(false);
    expect(plan.isNavigable).toBe(false);
  });

  it('opens every file type in its built-in viewer', async () => {
    const viewers = {
      'paper.pdf': 'files',
      'report.docx': 'files',
      'pathway.llmap': 'maps',
      'flux.graph': 'sankey',
      'genes.enrichment': 'enrichment-table',
      'plan.json': 'dmp',
      'article.bioc': 'bioc',
      'protein.pdb': 'structure',
      'model.cif': 'structure',
      'samples.sdrf.tsv': 'sdrf',
      'notes.txt': 'code',
      'script.py': 'code',
      'table.csv': 'code',
    };
    const all = folder.dir('All');
    for (const name of Object.keys(viewers)) {
      all.file(name, name === 'plan.json' ? '{"dmp": {"title": "Plan"}}' : 'content');
    }
    for (const [name, viewer] of Object.entries(viewers)) {
      const object = await firstValueFrom(service.get(id(`All/${name}`)));
      expect(object.isOpenable).withContext(name).toBe(true);
      expect(object.getCommands()).withContext(name).toEqual(['/projects', 'Lab', viewer, id(`All/${name}`)]);
    }
  });

  it('reads content', async () => {
    const blob = await firstValueFrom(service.getContent(id('notes.txt')));
    expect(await blob.text()).toBe('hello');
    expect(await (await firstValueFrom(service.getContentAsPdf(id('paper.pdf')))).text()).toBe('%PDF-1.7 ...');
  });

  describe('shows office documents as PDFs', () => {
    let converter: jasmine.SpyObj<OfficeConverterService>;
    let available: boolean;

    beforeEach(() => {
      available = true;
      converter = TestBed.inject(OfficeConverterService) as jasmine.SpyObj<OfficeConverterService>;
      spyOnProperty(converter, 'available').and.callFake(() => available);
      spyOn(converter, 'toPdf');
      folder.file('report.docx', 'PK...');
    });

    it('converting them in the browser', async () => {
      converter.toPdf.and.returnValue(of(new Blob(['%PDF-1.7 converted'])));
      const pdf = await firstValueFrom(service.getContentAsPdf(id('report.docx')));
      expect(await pdf.text()).toBe('%PDF-1.7 converted');
      const [file, name] = converter.toPdf.calls.mostRecent().args;
      expect(await file.text()).toBe('PK...');
      expect(name).toBe('report.docx');
      TestBed.inject(HttpTestingController).expectNone('/api/filesystem/convert/pdf');
    });

    async function convertedOnServer(): Promise<string> {
      const http = TestBed.inject(HttpTestingController);
      const pdf = firstValueFrom(service.getContentAsPdf(id('report.docx')));
      let requests: TestRequest[] = [];
      await waitFor(() => (requests = http.match('/api/filesystem/convert/pdf')).length > 0);
      expect(requests[0].request.body.get('file').name).toBe('report.docx');
      requests[0].flush(new Blob(['%PDF-1.7 server']));
      return (await pdf).text();
    }

    it('converting them on the server where the browser cannot', async () => {
      available = false;
      expect(await convertedOnServer()).toBe('%PDF-1.7 server');
      expect(converter.toPdf).not.toHaveBeenCalled();
    });

    it('converting them on the server when the browser fails to', async () => {
      spyOn(console, 'warn');
      converter.toPdf.and.returnValue(throwError(() => new Error('The engine stopped.')));
      expect(await convertedOnServer()).toBe('%PDF-1.7 server');
      expect(console.warn).toHaveBeenCalled();
    });
  });

  it('reports missing files clearly', async () => {
    await expectAsync(firstValueFrom(service.get(id('nope.pdf')))).toBeRejectedWith(jasmine.any(LocalFolderError));
  });

  it('creates files without overwriting existing ones', async () => {
    const event = await firstValueFrom(service.create({
      filename: 'notes.txt',
      parentHashId: id(''),
      contentValue: new Blob(['new']),
    }));
    expect(event.type).toBe(HttpEventType.Response);
    expect(event.bodyValue.filename).toBe('notes (2).txt');
    expect(await folder.readText('notes (2).txt')).toBe('new');
    expect(await folder.readText('notes.txt')).toBe('hello');
  });

  it('creates folders and maps with their extension', async () => {
    const dir = await firstValueFrom(service.create({
      filename: 'New',
      parentHashId: id('Results'),
      mimeType: MimeTypes.Directory,
    }));
    expect(dir.bodyValue.isDirectory).toBe(true);
    expect(folder.at('Results/New')).toEqual(jasmine.any(MemoryDirectoryHandle));

    const map = await firstValueFrom(service.create({
      filename: 'Pathway',
      parentHashId: id(''),
      mimeType: MimeTypes.Map,
      contentValue: new Blob(['zip']),
    }));
    expect(map.bodyValue.filename).toBe('Pathway.llmap');
  });

  it('saves content, renames and moves files', async () => {
    await firstValueFrom(service.save([id('notes.txt')], {contentValue: new Blob(['changed'])}));
    expect(await folder.readText('notes.txt')).toBe('changed');

    const renamed = await firstValueFrom(service.save([id('notes.txt')], {filename: 'renamed.txt'}));
    expect(renamed[id('notes.txt')].hashId).toBe(id('renamed.txt'));
    expect(folder.at('notes.txt')).toBeUndefined();

    await firstValueFrom(service.save([id('renamed.txt')], {parentHashId: id('Results')}));
    expect(await folder.readText('Results/renamed.txt')).toBe('changed');
  });

  it('refuses to move items into a project', async () => {
    await expectAsync(firstValueFrom(service.save([id('notes.txt')], {parentHashId: 'serverHash'})))
      .toBeRejectedWith(jasmine.any(LocalFolderError));
  });

  it('deletes files and folders but not the connected folder', async () => {
    await firstValueFrom(service.delete([id('Results')]));
    expect(folder.at('Results')).toBeUndefined();
    await expectAsync(firstValueFrom(service.delete([id('')]))).toBeRejectedWith(jasmine.any(LocalFolderError));
  });

  it('tells listeners about listings and changes', async () => {
    const events = [];
    service.events$.subscribe(event => events.push(event.type));
    await firstValueFrom(service.get(id('')));
    await firstValueFrom(service.get(id('paper.pdf')));
    await firstValueFrom(service.save([id('notes.txt')], {contentValue: new Blob(['x'])}));
    expect(events).toEqual(['listed', 'opened', 'changed']);
  });

  it('describes files without touching the disk', () => {
    const object = service.describe(root, 'Results/plan.json', {mimeType: MimeTypes.Dmp, size: 3, lastModified: 0});
    expect(object.hashId).toBe(id('Results/plan.json'));
    expect(object.parent.parent.hashId).toBe(id(''));
    expect((folder.at('Results/plan.json') as MemoryFileHandle).writes).toBe(0);
  });
});
