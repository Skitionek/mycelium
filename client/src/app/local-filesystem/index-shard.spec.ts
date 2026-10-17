import { MimeTypes } from 'app/shared/constants';

import {
  annotationFileName,
  emptyShard,
  IndexEntry,
  INDEXER_VERSION,
  MANIFEST_FORMAT,
  parseManifest,
  parseShard,
  pendingWork,
  pruneShard,
  readAnnotationFile,
  readManifest,
  readShard,
  removeAnnotationFiles,
  SHARD_VERSION,
  writeAnnotationFile,
  writeManifest,
  writeShard,
} from './index-shard';
import { MemoryDirectoryHandle } from './testing/memory-filesystem.spec';

function entry(overrides: Partial<IndexEntry> = {}): IndexEntry {
  return {
    size: 10,
    lastModified: 1000,
    mimeType: MimeTypes.Pdf,
    state: 'indexed',
    indexer: INDEXER_VERSION,
    indexedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const isPdf = (mimeType: string, size: number) => mimeType === MimeTypes.Pdf && size < 100;

describe('local index shards', () => {
  it('decides what is left to do for a file', () => {
    const file = {size: 10, lastModified: 1000};
    expect(pendingWork(undefined, file, true, isPdf)).toBe('index');
    expect(pendingWork(entry({size: 11}), file, true, isPdf)).toBe('index');
    expect(pendingWork(entry({lastModified: 999}), file, true, isPdf)).toBe('index');
    expect(pendingWork(entry({indexer: INDEXER_VERSION - 1}), file, true, isPdf)).toBe('index');
    expect(pendingWork(entry({state: 'failed'}), file, true, isPdf)).toBe('index');
    expect(pendingWork(entry(), file, true, isPdf)).toBe('annotate');
    expect(pendingWork(entry(), file, false, isPdf)).toBe('none');
    expect(pendingWork(entry({annotations: {state: 'done', file: 'x.json', date: ''}}), file, true, isPdf)).toBe('none');
    expect(pendingWork(entry({annotations: {state: 'failed', date: ''}}), file, true, isPdf)).toBe('annotate');
    expect(pendingWork(entry({mimeType: 'text/plain'}), file, true, isPdf)).toBe('none');
    // Too large to send for annotation
    expect(pendingWork(entry({size: 500}), {size: 500, lastModified: 1000}, true, isPdf)).toBe('none');
    expect(pendingWork(entry({state: 'skipped', mimeType: 'image/png'}), file, true, isPdf)).toBe('none');
  });

  it('ignores shards it does not understand', () => {
    expect(parseShard('not json')).toBeNull();
    expect(parseShard(JSON.stringify({format: 'other', version: SHARD_VERSION, entries: {}}))).toBeNull();
    expect(parseShard(JSON.stringify({...emptyShard(), version: SHARD_VERSION + 1}))).toBeNull();
    const shard = parseShard(JSON.stringify({...emptyShard(), entries: {good: entry(), bad: {size: 'x'}}}));
    expect(Object.keys(shard.entries)).toEqual(['good']);
  });

  it('prunes entries of files that are gone', () => {
    const shard = emptyShard();
    shard.entries.a = entry();
    shard.entries.b = entry();
    expect(pruneShard(shard, new Set(['a']))).toEqual(['b']);
    expect(Object.keys(shard.entries)).toEqual(['a']);
  });

  it('stores shards, manifests and annotations in a hidden directory', async () => {
    const dir = new MemoryDirectoryHandle('folder');
    expect(await readShard(dir)).toBeNull();
    expect(dir.children.size).toBe(0);

    const shard = emptyShard();
    shard.entries['paper.pdf'] = entry();
    await writeShard(dir, shard);
    expect((await readShard(dir)).entries['paper.pdf']).toEqual(entry());
    expect(dir.at('.mycelium/index.json')).toBeDefined();

    await writeManifest(dir, {format: MANIFEST_FORMAT, version: 1, rootId: 'abcdefgh12345678', name: 'folder', createdAt: ''});
    expect((await readManifest(dir)).rootId).toBe('abcdefgh12345678');
    expect(parseManifest('{"format": "mycelium-local-folder", "rootId": "../evil"}')).toBeNull();

    const key = annotationFileName('paper.pdf', {size: 10, lastModified: 1000});
    await writeAnnotationFile(dir, key, [{id: 1}]);
    await writeAnnotationFile(dir, 'stale.json', [{id: 2}]);
    expect(await readAnnotationFile(dir, key)).toEqual([{id: 1}]);
    await removeAnnotationFiles(dir, new Set([key]));
    expect(await readAnnotationFile(dir, 'stale.json')).toBeNull();
    expect(await readAnnotationFile(dir, key)).toEqual([{id: 1}]);
  });

  it('names annotation files after the file version', () => {
    const a = annotationFileName('paper.pdf', {size: 10, lastModified: 1000});
    expect(a).toBe(annotationFileName('paper.pdf', {size: 10, lastModified: 1000}));
    expect(a).not.toBe(annotationFileName('paper.pdf', {size: 10, lastModified: 2000}));
    expect(a).not.toBe(annotationFileName('other.pdf', {size: 10, lastModified: 1000}));
    expect(a).toMatch(/^[a-z0-9-]+\.json$/);
  });
});
