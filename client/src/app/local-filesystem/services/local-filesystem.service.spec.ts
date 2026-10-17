import { TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';

import { firstValueFrom } from 'rxjs';

import { MimeTypes } from 'app/shared/constants';

import { encodeLocalHashId } from '../local-ids';
import { LocalFolderError } from '../local-folder-errors';
import { MemoryDirectoryHandle, MemoryFileHandle } from '../testing/memory-filesystem.spec';
import { configureLocalFolderTestBed } from '../testing/local-folder-test-utils.spec';
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

  it('reads content', async () => {
    const blob = await firstValueFrom(service.getContent(id('notes.txt')));
    expect(await blob.text()).toBe('hello');
    expect(await (await firstValueFrom(service.getContentAsPdf(id('paper.pdf')))).text()).toBe('%PDF-1.7 ...');
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
