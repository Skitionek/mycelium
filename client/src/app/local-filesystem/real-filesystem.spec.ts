import { TestBed } from '@angular/core/testing';

import { firstValueFrom } from 'rxjs';

import { LocalDirectoryHandle } from './fs-types';
import { encodeLocalHashId } from './local-ids';
import { parseShard, readManifest } from './index-shard';
import { IndexedDbLocalRootStore } from './local-root-store';
import { configureLocalFolderTestBed, waitFor } from './testing/local-folder-test-utils.spec';
import { LocalFolderRegistry } from './services/local-folder-registry.service';
import { LocalFilesystemService } from './services/local-filesystem.service';
import { LocalIndexerService } from './services/local-indexer.service';

/**
 * The same flows as the other specs, but against the browser's own File System Access
 * implementation. A folder picked by the user cannot be had in a headless test, so this
 * uses the origin private file system, whose handles are the same kind of object.
 */
describe('Local folders on the real File System Access API', () => {
  const storage: any = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  const available = storage != null && typeof storage.getDirectory === 'function';
  let origin: LocalDirectoryHandle;
  let folder: LocalDirectoryHandle;
  const folderName = `mycelium-spec-${Date.now()}`;

  async function write(dir: LocalDirectoryHandle, name: string, content: string) {
    const handle = await dir.getFileHandle(name, {create: true});
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function read(dir: LocalDirectoryHandle, path: string): Promise<string | null> {
    const segments = path.split('/');
    let current = dir;
    try {
      for (const segment of segments.slice(0, -1)) {
        current = await current.getDirectoryHandle(segment);
      }
      return await (await (await current.getFileHandle(segments[segments.length - 1])).getFile()).text();
    } catch (e) {
      return null;
    }
  }

  beforeEach(async () => {
    if (!available) {
      return;
    }
    configureLocalFolderTestBed();
    origin = await storage.getDirectory();
    folder = await origin.getDirectoryHandle(folderName, {create: true});
    await write(folder, 'notes.txt', 'Ribosome biogenesis notes');
    const data = await folder.getDirectoryHandle('Data', {create: true});
    await write(data, 'plan.json', '{"dmp": {"title": "Sequencing plan"}}');
  });

  afterEach(async () => {
    if (!available) {
      return;
    }
    TestBed.inject(LocalIndexerService).ngOnDestroy();
    await origin.removeEntry(folderName, {recursive: true});
  });

  it('browses, indexes, and picks the index up again after reconnecting', async () => {
    if (!available) {
      pending('The origin private file system is not available in this browser');
      return;
    }
    const registry = TestBed.inject(LocalFolderRegistry);
    const filesystem = TestBed.inject(LocalFilesystemService);
    const indexer = TestBed.inject(LocalIndexerService);

    const root = await registry.connect(folder);
    expect(root.access).toBe('granted');
    expect((await readManifest(folder)).rootId).toBe(root.id);

    const listing = await firstValueFrom(filesystem.get(encodeLocalHashId(root.id, '')));
    expect(listing.children.items.map(child => child.filename).sort()).toEqual(['Data', 'notes.txt']);
    const plan = await firstValueFrom(filesystem.get(encodeLocalHashId(root.id, 'Data/plan.json')));
    expect(plan.mimeType).toBe('vnd.mycelium.document/dmp');

    await waitFor(() => {
      const status = indexer.getRootStatus(root.id);
      return status != null && status.phase === 'idle' && status.indexed === 2;
    });
    await indexer.flushAll();
    expect(indexer.search('ribosome').map(hit => hit.path)).toEqual(['notes.txt']);
    expect(parseShard(await read(folder, '.mycelium/index.json')).entries['notes.txt'].text.terms.ribosome).toBe(1);
    expect(parseShard(await read(folder, 'Data/.mycelium/index.json')).entries['plan.json']).toBeDefined();

    await registry.disconnect(root.id);
    const again = await registry.connect(folder);
    expect(again.id).toBe(root.id);
    await waitFor(() => {
      const status = indexer.getRootStatus(again.id);
      return status != null && status.phase === 'idle' && status.files === 2;
    });
    expect(indexer.getRootStatus(again.id).resumed).toBe(2);
  });

  it('writes, renames and deletes files', async () => {
    if (!available) {
      pending('The origin private file system is not available in this browser');
      return;
    }
    const root = await TestBed.inject(LocalFolderRegistry).connect(folder);
    const filesystem = TestBed.inject(LocalFilesystemService);
    const id = (path: string) => encodeLocalHashId(root.id, path);

    await firstValueFrom(filesystem.save([id('notes.txt')], {contentValue: new Blob(['Updated'])}));
    expect(await read(folder, 'notes.txt')).toBe('Updated');

    await firstValueFrom(filesystem.save([id('notes.txt')], {filename: 'renamed.txt'}));
    expect(await read(folder, 'renamed.txt')).toBe('Updated');
    expect(await read(folder, 'notes.txt')).toBeNull();

    await firstValueFrom(filesystem.save([id('renamed.txt')], {parentHashId: id('Data')}));
    expect(await read(folder, 'Data/renamed.txt')).toBe('Updated');

    await firstValueFrom(filesystem.delete([id('Data/renamed.txt')]));
    expect(await read(folder, 'Data/renamed.txt')).toBeNull();
  });

  it('remembers real directory handles in IndexedDB', async () => {
    if (!available) {
      pending('The origin private file system is not available in this browser');
      return;
    }
    const store = new IndexedDbLocalRootStore();
    await store.put({id: 'specroot00000001', name: folder.name, handle: folder, addedAt: '', annotate: true});
    const stored = (await store.list()).find(root => root.id === 'specroot00000001');
    expect(await stored.handle.isSameEntry(folder)).toBe(true);
    await store.delete('specroot00000001');
    expect((await store.list()).some(root => root.id === 'specroot00000001')).toBe(false);
  });
});
