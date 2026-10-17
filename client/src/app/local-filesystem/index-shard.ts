import { isNotFoundError, LocalDirectoryHandle } from './fs-types';
import { isValidRootId } from './local-ids';
import { TermFrequencies } from './text-extraction';

/**
 * On-disk layout of the local index.
 *
 * Every indexed directory gets a hidden `.mycelium` directory next to the files it describes:
 *
 *     some-folder/
 *       paper.pdf
 *       .mycelium/
 *         index.json            <- shard: one entry per file in some-folder/
 *         annotations/<key>.json <- entity annotations of one file
 *         manifest.json         <- only in the connected folder: its identity and settings
 *
 * Shards travel with the files, so an index survives the folder being disconnected,
 * reconnected, moved, or connected from a parent or child folder instead: each entry is
 * matched to its file by name, size and modification time, and only files that changed
 * since they were indexed are processed again.
 */

export const INDEX_DIR_NAME = '.mycelium';
export const SHARD_FILE_NAME = 'index.json';
export const MANIFEST_FILE_NAME = 'manifest.json';
export const ANNOTATIONS_DIR_NAME = 'annotations';

export const SHARD_FORMAT = 'mycelium-local-index';
export const MANIFEST_FORMAT = 'mycelium-local-folder';
export const SHARD_VERSION = 1;

/**
 * Bumped whenever the way text is extracted or tokenized changes, so older entries
 * are re-indexed.
 */
export const INDEXER_VERSION = 1;

export type IndexEntryState = 'indexed' | 'skipped' | 'failed';
export type AnnotationEntryState = 'done' | 'failed';

export interface AnnotationIndexEntry {
  state: AnnotationEntryState;
  /** Path of the annotation file inside the shard's annotations directory. */
  file?: string;
  count?: number;
  error?: string;
  date: string;
}

export interface IndexEntry {
  size: number;
  lastModified: number;
  mimeType: string;
  state: IndexEntryState;
  indexer: number;
  indexedAt: string;
  error?: string;
  text?: {
    chars: number;
    pages?: number;
    excerpt: string;
    terms: TermFrequencies;
  };
  annotations?: AnnotationIndexEntry;
}

export interface IndexShard {
  format: string;
  version: number;
  updatedAt: string;
  entries: { [filename: string]: IndexEntry };
}

export interface FolderManifest {
  format: string;
  version: number;
  rootId: string;
  name: string;
  createdAt: string;
  /** Whether PDFs are sent to the server to identify entities. */
  annotate?: boolean;
}

export interface FileFingerprint {
  size: number;
  lastModified: number;
}

/**
 * What still has to be done for a file given its shard entry.
 */
export type PendingWork = 'none' | 'index' | 'annotate';

export function emptyShard(): IndexShard {
  return {
    format: SHARD_FORMAT,
    version: SHARD_VERSION,
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

/**
 * Parse a shard, discarding it when it is not one or comes from a newer format.
 */
export function parseShard(text: string): IndexShard | null {
  try {
    const data = JSON.parse(text);
    if (data == null || data.format !== SHARD_FORMAT || data.version !== SHARD_VERSION
      || data.entries == null || typeof data.entries !== 'object') {
      return null;
    }
    const entries: { [filename: string]: IndexEntry } = {};
    for (const [name, entry] of Object.entries<any>(data.entries)) {
      if (entry != null && typeof entry.size === 'number' && typeof entry.lastModified === 'number'
        && typeof entry.state === 'string') {
        entries[name] = entry;
      }
    }
    return {...data, entries};
  } catch (e) {
    return null;
  }
}

export function parseManifest(text: string): FolderManifest | null {
  try {
    const data = JSON.parse(text);
    if (data == null || data.format !== MANIFEST_FORMAT || !isValidRootId(data.rootId)) {
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

export function matchesFingerprint(entry: IndexEntry | undefined, file: FileFingerprint): boolean {
  return entry != null && entry.size === file.size && entry.lastModified === file.lastModified;
}

/**
 * Decide what is left to do for a file. Files that failed are tried again on the next scan,
 * but a file whose text was indexed only needs its annotations redone.
 */
export function pendingWork(entry: IndexEntry | undefined, file: FileFingerprint, annotate: boolean,
                            needsAnnotations: (mimeType: string, size: number) => boolean): PendingWork {
  if (!matchesFingerprint(entry, file) || entry.indexer !== INDEXER_VERSION || entry.state === 'failed') {
    return 'index';
  }
  if (annotate && entry.state === 'indexed' && needsAnnotations(entry.mimeType, entry.size)
    && (entry.annotations == null || entry.annotations.state === 'failed')) {
    return 'annotate';
  }
  return 'none';
}

/**
 * Drop entries whose files are gone.
 * @return the names of the removed entries
 */
export function pruneShard(shard: IndexShard, presentNames: Set<string>): string[] {
  const removed = Object.keys(shard.entries).filter(name => !presentNames.has(name));
  for (const name of removed) {
    delete shard.entries[name];
  }
  return removed;
}

/**
 * A stable file name for a file's annotations within its directory.
 */
export function annotationFileName(filename: string, fingerprint: FileFingerprint): string {
  return `${fnv1a(filename)}-${fingerprint.size.toString(36)}-${Math.floor(fingerprint.lastModified).toString(36)}.json`;
}

export async function getIndexDirectory(dir: LocalDirectoryHandle, create: boolean): Promise<LocalDirectoryHandle | null> {
  try {
    return await dir.getDirectoryHandle(INDEX_DIR_NAME, {create});
  } catch (e) {
    if (isNotFoundError(e) || (!create && e && e.name === 'TypeMismatchError')) {
      return null;
    }
    throw e;
  }
}

export async function readJsonFile(dir: LocalDirectoryHandle, name: string): Promise<string | null> {
  try {
    const handle = await dir.getFileHandle(name);
    return await (await handle.getFile()).text();
  } catch (e) {
    if (isNotFoundError(e) || (e && e.name === 'TypeMismatchError')) {
      return null;
    }
    throw e;
  }
}

export async function writeTextFile(dir: LocalDirectoryHandle, name: string, text: string): Promise<void> {
  const handle = await dir.getFileHandle(name, {create: true});
  // The browser writes to a swap file and only replaces the original on close, so an
  // interrupted write never leaves a truncated shard behind.
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
    await writable.close();
  } catch (e) {
    if (writable.abort) {
      await writable.abort().catch(() => undefined);
    }
    throw e;
  }
}

export async function readShard(dir: LocalDirectoryHandle): Promise<IndexShard | null> {
  const indexDir = await getIndexDirectory(dir, false);
  if (indexDir == null) {
    return null;
  }
  const text = await readJsonFile(indexDir, SHARD_FILE_NAME);
  return text != null ? parseShard(text) : null;
}

export async function writeShard(dir: LocalDirectoryHandle, shard: IndexShard): Promise<void> {
  const indexDir = await getIndexDirectory(dir, true);
  shard.updatedAt = new Date().toISOString();
  await writeTextFile(indexDir, SHARD_FILE_NAME, JSON.stringify(shard));
}

export async function readManifest(dir: LocalDirectoryHandle): Promise<FolderManifest | null> {
  const indexDir = await getIndexDirectory(dir, false);
  if (indexDir == null) {
    return null;
  }
  const text = await readJsonFile(indexDir, MANIFEST_FILE_NAME);
  return text != null ? parseManifest(text) : null;
}

export async function writeManifest(dir: LocalDirectoryHandle, manifest: FolderManifest): Promise<void> {
  const indexDir = await getIndexDirectory(dir, true);
  await writeTextFile(indexDir, MANIFEST_FILE_NAME, JSON.stringify(manifest, null, 2));
}

export async function writeAnnotationFile(dir: LocalDirectoryHandle, fileName: string, annotations: any[]): Promise<void> {
  const indexDir = await getIndexDirectory(dir, true);
  const annotationsDir = await indexDir.getDirectoryHandle(ANNOTATIONS_DIR_NAME, {create: true});
  await writeTextFile(annotationsDir, fileName, JSON.stringify(annotations));
}

export async function readAnnotationFile(dir: LocalDirectoryHandle, fileName: string): Promise<any[] | null> {
  const indexDir = await getIndexDirectory(dir, false);
  if (indexDir == null) {
    return null;
  }
  let annotationsDir: LocalDirectoryHandle;
  try {
    annotationsDir = await indexDir.getDirectoryHandle(ANNOTATIONS_DIR_NAME);
  } catch (e) {
    if (isNotFoundError(e)) {
      return null;
    }
    throw e;
  }
  const text = await readJsonFile(annotationsDir, fileName);
  if (text == null) {
    return null;
  }
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
  }
}

export async function removeAnnotationFiles(dir: LocalDirectoryHandle, keep: Set<string>): Promise<void> {
  const indexDir = await getIndexDirectory(dir, false);
  if (indexDir == null) {
    return;
  }
  let annotationsDir: LocalDirectoryHandle;
  try {
    annotationsDir = await indexDir.getDirectoryHandle(ANNOTATIONS_DIR_NAME);
  } catch (e) {
    return;
  }
  const stale: string[] = [];
  for await (const entry of annotationsDir.values()) {
    if (entry.kind === 'file' && !keep.has(entry.name)) {
      stale.push(entry.name);
    }
  }
  for (const name of stale) {
    await annotationsDir.removeEntry(name).catch(() => undefined);
  }
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    // tslint:disable-next-line:no-bitwise
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // tslint:disable-next-line:no-bitwise
  return (hash >>> 0).toString(16).padStart(8, '0');
}
