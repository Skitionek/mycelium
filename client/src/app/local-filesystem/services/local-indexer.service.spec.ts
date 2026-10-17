import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { firstValueFrom } from 'rxjs';

import { encodeLocalHashId } from '../local-ids';
import { annotationFileName, parseShard } from '../index-shard';
import { ExtractedText } from '../text-extraction';
import { MemoryDirectoryHandle, MemoryFileHandle } from '../testing/memory-filesystem.spec';
import { configureLocalFolderTestBed, waitFor } from '../testing/local-folder-test-utils.spec';
import { LocalFolderRegistry, LocalRoot } from './local-folder-registry.service';
import { LocalFilesystemService } from './local-filesystem.service';
import { LocalIndexerService, scoreEntry, summarize } from './local-indexer.service';

const TRANSIENT_URL = '/api/filesystem/annotations/transient';
const GENE_ANNOTATION = {
  meta: {type: 'Gene', id: '672', allText: 'BRCA1'},
  pageNumber: 1,
  rects: [[10, 20, 30, 40]],
  keywords: ['BRCA1'],
  keyword: 'BRCA1',
};

describe('LocalIndexerService', () => {
  let registry: LocalFolderRegistry;
  let indexer: LocalIndexerService;
  let http: HttpTestingController;
  let folder: MemoryDirectoryHandle;
  let extracted: string[];

  function createIndexer() {
    indexer = TestBed.inject(LocalIndexerService);
    extracted = [];
    const real = (indexer as any).textExtractor;
    (indexer as any).textExtractor = async (file: File, mimeType: string): Promise<ExtractedText | null> => {
      extracted.push(file.name);
      if (mimeType === 'application/pdf') {
        // PDF.js cannot load its worker in unit tests
        return {text: 'BRCA1 tumour suppressor', pages: 2};
      }
      return real(file, mimeType);
    };
  }

  function status(root: LocalRoot) {
    return indexer.getRootStatus(root.id);
  }

  async function settle(root: LocalRoot) {
    await waitFor(() => {
      const current = status(root);
      return current != null && current.phase === 'idle' && current.files > 0;
    });
    await indexer.flushAll();
  }

  async function shardOf(path: string) {
    const text = await folder.readText(path ? `${path}/.mycelium/index.json` : '.mycelium/index.json');
    return text == null ? null : parseShard(text);
  }

  beforeEach(() => {
    configureLocalFolderTestBed();
    registry = TestBed.inject(LocalFolderRegistry);
    http = TestBed.inject(HttpTestingController);
    folder = new MemoryDirectoryHandle('Lab');
    folder.file('notes.txt', 'Kinase signalling notes, kinase again');
    folder.file('figure.png', new Blob([new Uint8Array([137, 80, 78, 71])]));
    folder.file('.hidden.txt', 'not indexed');
    const sub = folder.dir('Data');
    sub.file('pathway.json', '{"title": "MAPK cascade"}');
    sub.dir('Empty');
  });

  afterEach(() => {
    if (indexer != null) {
      indexer.ngOnDestroy();
      indexer = undefined;
    }
  });

  it('indexes a folder and saves shards next to the files', async () => {
    createIndexer();
    const root = await registry.connect(folder);
    await registry.setAnnotate(root.id, false);
    await settle(root);

    expect(status(root)).toEqual(jasmine.objectContaining({
      files: 3, indexed: 2, skipped: 1, failed: 0, queued: 0, resumed: 0, persisted: true,
    }));

    const top = await shardOf('');
    expect(Object.keys(top.entries).sort()).toEqual(['figure.png', 'notes.txt']);
    expect(top.entries['notes.txt'].text.terms.kinase).toBe(2);
    expect(top.entries['figure.png'].state).toBe('skipped');
    expect((await shardOf('Data')).entries['pathway.json'].text.terms.mapk).toBe(1);
    // Nothing to index, nothing written
    expect(folder.at('Data/Empty/.mycelium')).toBeUndefined();

    expect(indexer.getFileStatus(encodeLocalHashId(root.id, 'notes.txt')).state).toBe('indexed');
  });

  it('searches indexed text and names', async () => {
    createIndexer();
    const root = await registry.connect(folder);
    await registry.setAnnotate(root.id, false);
    await settle(root);

    expect(indexer.search('kinase').map(hit => hit.path)).toEqual(['notes.txt']);
    expect(indexer.search('mapk cascade').map(hit => hit.path)).toEqual(['Data/pathway.json']);
    expect(indexer.search('figu').map(hit => hit.path)).toEqual(['figure.png']);
    expect(indexer.search('kinase mapk')).toEqual([]);
    expect(indexer.search('not')).toEqual([]);
  });

  it('picks up the existing index when a folder is connected again', async () => {
    createIndexer();
    const first = await registry.connect(folder);
    await registry.setAnnotate(first.id, false);
    await settle(first);
    expect(extracted.sort()).toEqual(['notes.txt', 'pathway.json']);

    await registry.disconnect(first.id);
    (folder.at('notes.txt') as MemoryFileHandle).setContent('Phosphatase notes');
    extracted = [];

    const second = await registry.connect(folder);
    expect(second.id).toBe(first.id);
    await settle(second);

    // Only the file that changed while disconnected is processed again
    expect(extracted).toEqual(['notes.txt']);
    expect(status(second)).toEqual(jasmine.objectContaining({files: 3, indexed: 2, skipped: 1, resumed: 2}));
    expect(indexer.search('phosphatase').map(hit => hit.path)).toEqual(['notes.txt']);
    expect(indexer.search('kinase')).toEqual([]);
  });

  it('keeps finished work when disconnected part way', async () => {
    createIndexer();
    let release: () => void;
    const blocked = new Promise<void>(resolve => release = resolve);
    const fast = (indexer as any).textExtractor;
    let started = false;
    (indexer as any).textExtractor = async (file: File, mimeType: string) => {
      if (file.name === 'pathway.json') {
        started = true;
        await blocked;
      }
      return fast(file, mimeType);
    };
    const root = await registry.connect(folder);
    await registry.setAnnotate(root.id, false);
    await waitFor(() => started);

    await registry.disconnect(root.id);
    release();
    await new Promise(resolve => setTimeout(resolve, 50));
    await indexer.flushAll();

    expect(Object.keys((await shardOf('')).entries).sort()).toEqual(['figure.png', 'notes.txt']);
    expect(await shardOf('Data')).toBeNull();

    extracted = [];
    (indexer as any).textExtractor = fast;
    const again = await registry.connect(folder);
    await settle(again);
    expect(extracted).toEqual(['pathway.json']);
  });

  it('notices files created and deleted through Mycelium', async () => {
    createIndexer();
    const root = await registry.connect(folder);
    await registry.setAnnotate(root.id, false);
    await settle(root);
    const filesystem = TestBed.inject(LocalFilesystemService);

    await firstValueFrom(filesystem.create({
      filename: 'new.txt', parentHashId: encodeLocalHashId(root.id, 'Data'), contentValue: new Blob(['ribosome']),
    }));
    await waitFor(() => indexer.search('ribosome').length === 1);

    await firstValueFrom(filesystem.delete([encodeLocalHashId(root.id, 'notes.txt')]));
    await waitFor(() => indexer.search('kinase').length === 0);
    await indexer.flushAll();
    expect((await shardOf('')).entries['notes.txt']).toBeUndefined();
  });

  it('annotates PDFs through the server and serves the annotations from the folder', async () => {
    folder.file('paper.pdf', '%PDF-1.7 fake');
    createIndexer();
    const root = await registry.connect(folder);
    const hashId = encodeLocalHashId(root.id, 'paper.pdf');

    let requests = [];
    await waitFor(() => (requests = http.match(TRANSIENT_URL)).length > 0);
    expect(requests.length).toBe(1);
    expect(requests[0].request.method).toBe('POST');
    expect((requests[0].request.body as FormData).get('filename')).toBe('paper.pdf');
    requests[0].flush({results: [GENE_ANNOTATION], total: 1});

    await settle(root);
    const fileStatus = await firstValueFrom(indexer.fileStatus$(hashId));
    expect(fileStatus).toEqual(jasmine.objectContaining({state: 'indexed', annotations: 'done', annotationCount: 1}));

    const file = await (folder.at('paper.pdf') as MemoryFileHandle).getFile();
    expect(await folder.readText(`.mycelium/annotations/${annotationFileName('paper.pdf', file)}`)).toContain('BRCA1');
    expect(await indexer.getAnnotations(hashId)).toEqual([GENE_ANNOTATION as any]);

    // Annotation files live in the user's folder: malformed ones are not passed to the viewer
    const annotationPath = `.mycelium/annotations/${annotationFileName('paper.pdf', file)}`;
    (folder.at(annotationPath) as MemoryFileHandle).setContent(JSON.stringify([
      GENE_ANNOTATION, {meta: {type: '<img src=x>'}}, null, 'text',
    ]));
    expect(await indexer.getAnnotations(hashId)).toEqual([GENE_ANNOTATION as any]);

    // Reconnecting does not send the PDF again
    await registry.disconnect(root.id);
    const again = await registry.connect(folder);
    await settle(again);
    http.expectNone(TRANSIENT_URL);
    expect(indexer.getFileStatus(hashId).annotations).toBe('done');
  });

  it('pauses annotation when the server cannot annotate, keeping the text index', async () => {
    folder.file('a.pdf', '%PDF-1.7 a');
    folder.file('b.pdf', '%PDF-1.7 b');
    createIndexer();
    const root = await registry.connect(folder);

    let requests = [];
    await waitFor(() => (requests = http.match(TRANSIENT_URL)).length > 0);
    requests[0].flush({message: 'down'}, {status: 503, statusText: 'Service Unavailable'});

    await settle(root);
    http.expectNone(TRANSIENT_URL);
    expect(status(root)).toEqual(jasmine.objectContaining({indexed: 4, annotationsFailed: 2, annotated: 0}));
    expect(status(root).lastError).toContain('Annotation paused');
    expect(indexer.search('brca1').length).toBe(2);
  });

  it('does not write into read-only folders', async () => {
    folder.permission = 'denied';
    createIndexer();
    const root = await registry.connect(folder);
    await registry.setAnnotate(root.id, false);
    await settle(root);
    expect(status(root).persisted).toBe(false);
    expect(status(root).indexed).toBe(2);
    expect(folder.at('.mycelium')).toBeUndefined();
  });

  it('scores search terms and summarises statuses', () => {
    const entry = {
      size: 1, lastModified: 1, mimeType: 'text/plain', state: 'indexed' as const, indexer: 1, indexedAt: '',
      text: {chars: 1, excerpt: '', terms: {gene: 3, protein: 1}},
    };
    expect(scoreEntry(['gene'], 'x.txt', entry).matches).toEqual({gene: 3});
    expect(scoreEntry(['gene', 'missing'], 'x.txt', entry)).toBeNull();
    expect(scoreEntry(['gene'], 'gene-list.txt', entry).score).toBeGreaterThan(scoreEntry(['gene'], 'x.txt', entry).score);

    const summary = summarize([
      {rootId: 'a', phase: 'indexing', files: 10, indexed: 4, skipped: 1, failed: 0, queued: 5, annotationsQueued: 2,
        annotated: 0, annotationsFailed: 0, resumed: 0, persisted: true},
      {rootId: 'b', phase: 'waiting', files: 0, indexed: 0, skipped: 0, failed: 0, queued: 0, annotationsQueued: 0,
        annotated: 0, annotationsFailed: 0, resumed: 0, persisted: true},
    ]);
    expect(summary).toEqual({roots: 2, active: true, files: 10, done: 5, queued: 5, annotationsQueued: 2, waiting: 1});
  });
});
