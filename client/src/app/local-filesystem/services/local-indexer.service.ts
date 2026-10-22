import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { BehaviorSubject, firstValueFrom, merge, Observable, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map, startWith } from 'rxjs/operators';

import { ApiService } from 'app/shared/services/api.service';
import { MimeTypes } from 'app/shared/constants';
import { Annotation } from 'app/pdf-viewer/annotation-type';

import { isPermissionError, LocalDirectoryHandle, LocalFileHandle } from '../fs-types';
import {
  baseName,
  decodeLocalHashId,
  encodeLocalHashId,
  joinPath,
  parentPath,
  splitPath,
} from '../local-ids';
import {
  annotationFileName,
  emptyShard,
  IndexEntry,
  IndexShard,
  INDEXER_VERSION,
  matchesFingerprint,
  pendingWork,
  pruneShard,
  readAnnotationFile,
  readShard,
  removeAnnotationFiles,
  writeAnnotationFile,
  writeShard,
} from '../index-shard';
import { countTerms, extractText, ExtractedText, isTextIndexable, makeExcerpt, tokenize } from '../text-extraction';
import { LocalFolderRegistry, LocalRoot } from './local-folder-registry.service';
import { isHiddenName, LocalFileListing, LocalFilesystemEvent, LocalFilesystemService } from './local-filesystem.service';

export type LocalFileIndexState = 'queued' | 'indexing' | 'indexed' | 'skipped' | 'failed';
export type LocalAnnotationState = 'not-applicable' | 'off' | 'queued' | 'annotating' | 'done' | 'failed';

export interface LocalFileIndexStatus {
  state: LocalFileIndexState;
  annotations: LocalAnnotationState;
  /** Number of distinct terms indexed. */
  terms?: number;
  pages?: number;
  annotationCount?: number;
  indexedAt?: string;
  error?: string;
  annotationError?: string;
}

/**
 * - waiting: the folder is not accessible right now (needs reconnecting)
 * - scanning: looking for new and changed files
 * - indexing: files are being indexed or annotated
 * - idle: everything is up to date
 */
export type LocalRootIndexPhase = 'waiting' | 'scanning' | 'indexing' | 'idle';

export interface LocalRootIndexStatus {
  rootId: string;
  phase: LocalRootIndexPhase;
  files: number;
  indexed: number;
  skipped: number;
  failed: number;
  queued: number;
  annotationsQueued: number;
  annotated: number;
  annotationsFailed: number;
  /** Files whose index was picked up from shards already in the folder. */
  resumed: number;
  /** Path of the file being worked on. */
  current?: string;
  /** Whether the index is saved into the folder; false when only read access was granted. */
  persisted: boolean;
  lastError?: string;
}

export interface LocalIndexSummary {
  roots: number;
  active: boolean;
  files: number;
  done: number;
  queued: number;
  annotationsQueued: number;
  waiting: number;
}

export interface LocalSearchHit {
  rootId: string;
  path: string;
  name: string;
  mimeType: string;
  score: number;
  /** Occurrences of each search term in the file's text. */
  matches: { [term: string]: number };
  excerpt?: string;
  size: number;
  lastModified: number;
}

interface FileState {
  name: string;
  handle: LocalFileHandle;
  size: number;
  lastModified: number;
  status: LocalFileIndexStatus;
  /** The current status came from a shard found in the folder rather than from work done now. */
  resumed: boolean;
}

interface DirState {
  path: string;
  handle: LocalDirectoryHandle;
  shard: IndexShard;
  files: Map<string, FileState>;
  dirty: boolean;
  /** Whether the folder already has a shard file, so an emptied shard still gets written. */
  onDisk: boolean;
  annotationsChanged: boolean;
  firstDirtyAt: number;
  flushTimer: any;
  writing: Promise<void>;
}

interface Job {
  dirPath: string;
  name: string;
  priority: number;
  order: number;
}

interface RootState {
  root: LocalRoot;
  generation: number;
  dirs: Map<string, DirState>;
  indexQueue: Job[];
  annotateQueue: Job[];
  indexing: boolean;
  annotating: boolean;
  scanning: number;
  annotationFailuresInRow: number;
  annotationSuspended: boolean;
  current?: string;
  lastError?: string;
  lastScanAt: number;
  observer: any;
  observerTimer: any;
  observedPaths: Set<string>;
}

const FLUSH_DELAY = 1000;
const FLUSH_MAX_WAIT = 5000;
const STATUS_THROTTLE = 250;
const RESCAN_ON_FOCUS_INTERVAL = 60 * 1000;
const MAX_ANNOTATION_FAILURES_IN_ROW = 3;
const MAX_SEARCH_HITS = 200;
const OPENED_PRIORITY = 10;
/** Match the appserver's limits for annotating files it does not store. */
export const MAX_ANNOTATED_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_ANNOTATED_ENRICHMENT_TABLE_BYTES = 32 * 1024 * 1024;

/** An enrichment table with its cells annotated, as the appserver returns it. */
export interface AnnotatedEnrichmentTable {
  result: { genes: any[], [key: string]: any };
  [key: string]: any;
}

/**
 * Indexes connected local folders in the background, as files appear and change.
 *
 * For each file the indexer extracts its text in the browser and records its terms, so local
 * folders can be searched; PDFs and enrichment tables are additionally sent to the appserver
 * once (without being stored there) to identify biological entities, which their viewers then
 * show exactly as they do for uploaded documents.
 *
 * Results are written as shards into hidden `.mycelium` directories inside the folder itself
 * (see index-shard.ts), a second after each file is done. Disconnecting a folder - or closing
 * the tab - therefore loses at most the file being worked on, and when the folder is
 * connected again only files that are new or changed since are processed.
 */
@Injectable({providedIn: 'root'})
export class LocalIndexerService implements OnDestroy {
  private readonly states = new Map<string, RootState>();
  private readonly statusSubject = new BehaviorSubject<Map<string, LocalRootIndexStatus>>(new Map());
  readonly status$: Observable<Map<string, LocalRootIndexStatus>> = this.statusSubject.asObservable();
  readonly summary$: Observable<LocalIndexSummary> = this.status$.pipe(
    map(statuses => summarize(Array.from(statuses.values()))),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  );
  private readonly fileChanges = new Subject<string>();
  private readonly pendingFileChanges = new Set<string>();
  /** Annotations of folders that cannot be written to are kept in memory. */
  private readonly memoryAnnotations = new Map<string, any>();
  private readonly subscriptions = new Subscription();
  private statusTimer: any = null;
  private jobCounter = 0;
  /** Replaceable in tests, where PDF.js cannot load its worker. */
  protected textExtractor: (file: Blob, mimeType: string) => Promise<ExtractedText | null> = extractText;
  private readonly visibilityListener = () => this.onVisibilityChange();
  private readonly pageHideListener = () => this.flushAll();

  constructor(protected readonly registry: LocalFolderRegistry,
              protected readonly localFilesystem: LocalFilesystemService,
              protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly ngZone: NgZone) {
    this.subscriptions.add(this.registry.roots$.subscribe(roots => this.outside(() => this.sync(roots))));
    this.subscriptions.add(this.localFilesystem.events$.subscribe(event => this.outside(() => this.onEvent(event))));
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityListener);
      window.addEventListener('pagehide', this.pageHideListener);
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      window.removeEventListener('pagehide', this.pageHideListener);
    }
    for (const rootId of Array.from(this.states.keys())) {
      this.stop(rootId, true);
    }
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * The current status, computed now rather than taken from the (throttled) status stream.
   */
  getRootStatus(rootId: string): LocalRootIndexStatus | undefined {
    const state = this.states.get(rootId);
    return state ? this.computeStatus(state) : undefined;
  }

  rootStatus$(rootId: string): Observable<LocalRootIndexStatus | undefined> {
    return this.status$.pipe(map(statuses => statuses.get(rootId)), distinctUntilChanged());
  }

  getFileStatus(hashId: string): LocalFileIndexStatus | undefined {
    const located = this.locate(hashId);
    return located && located.file ? located.file.status : undefined;
  }

  fileStatus$(hashId: string): Observable<LocalFileIndexStatus | undefined> {
    return this.fileChanges.pipe(
      filter(changed => changed === hashId),
      startWith(hashId),
      map(() => this.getFileStatus(hashId)),
      map(status => status ? {...status} : undefined),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    );
  }

  /**
   * Look for new and changed files again.
   * @param force re-extract the text of every file, as if nothing was indexed
   */
  rescan(rootId: string, force = false) {
    const state = this.states.get(rootId);
    if (state != null) {
      this.outside(() => {
        if (force) {
          this.restart(state);
        }
        this.scan(state, force);
      });
    }
  }

  /**
   * Move a file to the front of the queue, e.g. because the user just opened it.
   */
  prioritize(hashId: string) {
    const ref = decodeLocalHashId(hashId);
    const state = ref && this.states.get(ref.rootId);
    if (state == null) {
      return;
    }
    const dirPath = parentPath(ref.path);
    const name = baseName(ref.path);
    for (const queue of [state.indexQueue, state.annotateQueue]) {
      const job = queue.find(item => item.dirPath === dirPath && item.name === name);
      if (job != null) {
        job.priority = Math.max(job.priority, OPENED_PRIORITY);
      }
    }
  }

  /**
   * The entity annotations found in a local PDF, or an empty list if it has not been
   * annotated (yet).
   */
  async getAnnotations(hashId: string): Promise<Annotation[]> {
    const stored = await this.readStoredAnnotations(hashId);
    // The file is in the user's folder and may have been edited; pass on only well-formed annotations
    return Array.isArray(stored) ? stored.filter(isWellFormedAnnotation) : [];
  }

  /**
   * A local enrichment table with its cells annotated, or null if it is not annotated
   * because annotation is off or failed. A table that is still waiting to be annotated is
   * moved to the front of the queue and waited for.
   */
  async getEnrichmentAnnotations(hashId: string): Promise<AnnotatedEnrichmentTable | null> {
    this.prioritize(hashId);
    await firstValueFrom(merge(this.fileStatus$(hashId), this.status$).pipe(
      map(() => this.isSettled(hashId)),
      filter(settled => settled),
    ));
    const stored = await this.readStoredAnnotations(hashId);
    return isWellFormedEnrichmentTable(stored) ? stored : null;
  }

  /**
   * Full-text search over the indexed local folders. Every search term has to occur in the
   * file's text or name; the last term also matches the beginning of words in names.
   */
  search(query: string, rootIds?: string[]): LocalSearchHit[] {
    const terms = Array.from(new Set(tokenize(query)));
    if (!terms.length) {
      return [];
    }
    const hits: LocalSearchHit[] = [];
    for (const state of Array.from(this.states.values())) {
      if (rootIds != null && !rootIds.includes(state.root.id)) {
        continue;
      }
      for (const dir of Array.from(state.dirs.values())) {
        for (const [name, entry] of Object.entries(dir.shard.entries)) {
          const hit = scoreEntry(terms, name, entry);
          if (hit != null) {
            hits.push({
              rootId: state.root.id,
              path: joinPath(dir.path, name),
              name,
              mimeType: entry.mimeType,
              score: hit.score,
              matches: hit.matches,
              excerpt: entry.text ? entry.text.excerpt : undefined,
              size: entry.size,
              lastModified: entry.lastModified,
            });
          }
        }
      }
    }
    hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    return hits.slice(0, MAX_SEARCH_HITS);
  }

  /**
   * Write everything that is pending to the folders now.
   */
  flushAll(): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const state of Array.from(this.states.values())) {
      for (const dir of Array.from(state.dirs.values())) {
        pending.push(this.flush(state, dir));
      }
    }
    return Promise.all(pending).then(() => undefined);
  }

  // ========================================
  // Lifecycle
  // ========================================

  protected sync(roots: LocalRoot[]) {
    const ids = new Set(roots.map(root => root.id));
    for (const rootId of Array.from(this.states.keys())) {
      if (!ids.has(rootId)) {
        this.stop(rootId, true);
      }
    }
    for (const root of roots) {
      const state = this.states.get(root.id);
      if (root.access !== 'granted') {
        if (state != null) {
          this.stop(root.id, false);
          state.root = root;
        } else {
          this.states.set(root.id, this.createState(root));
        }
        this.scheduleStatus();
        continue;
      }
      if (state == null || state.root.access !== 'granted' || state.root.handle !== root.handle) {
        const fresh = state || this.createState(root);
        fresh.root = root;
        this.states.set(root.id, fresh);
        this.restart(fresh);
        this.observe(fresh);
        this.scan(fresh, false);
      } else if (state.root.annotate !== root.annotate || state.root.writable !== root.writable) {
        const annotationsEnabled = root.annotate && !state.root.annotate;
        state.root = root;
        if (annotationsEnabled) {
          state.annotationSuspended = false;
          state.annotationFailuresInRow = 0;
          this.scan(state, false);
        } else {
          this.refreshAnnotationStates(state);
        }
      }
    }
    this.scheduleStatus();
  }

  protected createState(root: LocalRoot): RootState {
    return {
      root,
      generation: 0,
      dirs: new Map(),
      indexQueue: [],
      annotateQueue: [],
      indexing: false,
      annotating: false,
      scanning: 0,
      annotationFailuresInRow: 0,
      annotationSuspended: false,
      lastScanAt: 0,
      observer: null,
      observerTimer: null,
      observedPaths: new Set(),
    };
  }

  /**
   * Abandon all work in progress and forget what was loaded; pending results are flushed.
   */
  protected restart(state: RootState) {
    state.generation++;
    for (const dir of Array.from(state.dirs.values())) {
      this.flush(state, dir);
    }
    state.dirs = new Map();
    state.indexQueue = [];
    state.annotateQueue = [];
    // Running loops notice the new generation and stop on their own
    state.indexing = false;
    state.annotating = false;
    state.current = undefined;
    state.lastError = undefined;
    state.annotationFailuresInRow = 0;
    state.annotationSuspended = false;
  }

  protected stop(rootId: string, forget: boolean) {
    const state = this.states.get(rootId);
    if (state == null) {
      return;
    }
    state.generation++;
    state.indexQueue = [];
    state.annotateQueue = [];
    state.indexing = false;
    state.annotating = false;
    state.current = undefined;
    clearTimeout(state.observerTimer);
    if (state.observer != null) {
      try {
        state.observer.disconnect();
      } catch (e) {
      }
      state.observer = null;
    }
    // Save what was done so far, so it is picked up when the folder comes back
    for (const dir of Array.from(state.dirs.values())) {
      this.flush(state, dir);
    }
    if (forget) {
      this.states.delete(rootId);
      for (const key of Array.from(this.memoryAnnotations.keys())) {
        if (key.startsWith(rootId + '/')) {
          this.memoryAnnotations.delete(key);
        }
      }
    }
    this.scheduleStatus();
  }

  // ========================================
  // Scanning
  // ========================================

  protected async scan(state: RootState, force: boolean) {
    if (state.root.access !== 'granted') {
      return;
    }
    const generation = state.generation;
    state.scanning++;
    state.lastScanAt = Date.now();
    this.scheduleStatus();
    try {
      await this.scanDir(state, '', state.root.handle, generation, {force, recursive: true});
    } catch (e) {
      if (generation === state.generation) {
        this.handleRootError(state, e);
      }
    } finally {
      state.scanning--;
      this.scheduleStatus();
    }
  }

  protected async scanDir(state: RootState, path: string, handle: LocalDirectoryHandle, generation: number,
                          options: { force: boolean, recursive: boolean }): Promise<void> {
    if (generation !== state.generation) {
      return;
    }
    const dir = await this.loadDir(state, path, handle, options.force);
    if (generation !== state.generation) {
      return;
    }

    const files: LocalFileListing[] = [];
    const subdirs: LocalDirectoryHandle[] = [];
    for await (const entry of handle.values()) {
      if (isHiddenName(entry.name)) {
        continue;
      }
      if (entry.kind === 'directory') {
        subdirs.push(entry);
      } else {
        try {
          const file = await entry.getFile();
          files.push({name: entry.name, size: file.size, lastModified: file.lastModified, handle: entry});
        } catch (e) {
          // Unreadable (locked, or removed meanwhile); it is picked up on a later scan
        }
      }
    }
    if (generation !== state.generation) {
      return;
    }
    this.reconcileDir(state, dir, files, options.force);

    // Forget subfolders that disappeared
    const subdirPaths = new Set(subdirs.map(subdir => joinPath(path, subdir.name)));
    for (const known of Array.from(state.dirs.keys())) {
      if (known !== path && parentPath(known) === path && !subdirPaths.has(known)) {
        this.forgetDir(state, known);
      }
    }

    this.pump(state);

    if (options.recursive) {
      for (const subdir of subdirs) {
        await yieldToBrowser();
        const subdirPath = joinPath(path, subdir.name);
        try {
          await this.scanDir(state, subdirPath, subdir, generation, options);
        } catch (e) {
          if (e && e.name === 'NotFoundError') {
            // Removed while scanning
            this.forgetDir(state, subdirPath);
          } else {
            throw e;
          }
        }
      }
    }
  }

  protected async loadDir(state: RootState, path: string, handle: LocalDirectoryHandle, force: boolean): Promise<DirState> {
    let dir = state.dirs.get(path);
    if (dir != null && !force) {
      dir.handle = handle;
      return dir;
    }
    const stored = await readShard(handle).catch(() => null);
    dir = {
      path,
      handle,
      shard: stored || emptyShard(),
      files: dir ? dir.files : new Map(),
      dirty: false,
      onDisk: stored != null,
      annotationsChanged: false,
      firstDirtyAt: 0,
      flushTimer: null,
      writing: dir ? dir.writing : Promise.resolve(),
    };
    state.dirs.set(path, dir);
    return dir;
  }

  /**
   * Bring a directory's state in line with the files it contains and queue what needs doing.
   */
  protected reconcileDir(state: RootState, dir: DirState, files: LocalFileListing[], force: boolean) {
    const present = new Set(files.map(file => file.name));
    for (const file of files) {
      this.reconcileFile(state, dir, file, force);
    }
    for (const name of Array.from(dir.files.keys())) {
      if (!present.has(name)) {
        dir.files.delete(name);
        this.removeJobs(state, dir.path, name);
        this.fileChanged(state, joinPath(dir.path, name));
      }
    }
    if (pruneShard(dir.shard, present).length) {
      dir.annotationsChanged = true;
      this.markDirty(state, dir);
    }
    this.scheduleStatus();
  }

  protected reconcileFile(state: RootState, dir: DirState, listing: LocalFileListing, force: boolean) {
    const entry = dir.shard.entries[listing.name];
    let file = dir.files.get(listing.name);
    const isNew = file == null;
    const changed = file != null && (file.size !== listing.size || file.lastModified !== listing.lastModified);
    if (file == null) {
      file = {
        name: listing.name,
        handle: listing.handle,
        size: listing.size,
        lastModified: listing.lastModified,
        status: {state: 'queued', annotations: 'not-applicable'},
        resumed: false,
      };
      dir.files.set(listing.name, file);
    }
    file.handle = listing.handle;
    file.size = listing.size;
    file.lastModified = listing.lastModified;

    const inProgress = this.hasJob(state.indexQueue, dir.path, listing.name) || file.status.state === 'indexing';
    if (inProgress && !changed) {
      return;
    }

    const work = force ? 'index' : pendingWork(entry, listing, state.root.annotate, needsAnnotations);
    if (work === 'index') {
      file.resumed = false;
      file.status = {
        state: 'queued',
        annotations: entry && needsAnnotations(entry.mimeType, listing.size)
          ? this.annotationStateOf(state, undefined)
          : 'not-applicable',
      };
      this.enqueue(state, state.indexQueue, dir.path, listing.name);
    } else {
      if (isNew) {
        file.resumed = true;
      }
      file.status = this.statusOf(state, entry);
      if (work === 'annotate' && !this.hasJob(state.annotateQueue, dir.path, listing.name)
        && file.status.annotations !== 'annotating') {
        file.status = {...file.status, annotations: state.annotationSuspended ? 'failed' : 'queued'};
        if (!state.annotationSuspended) {
          this.enqueue(state, state.annotateQueue, dir.path, listing.name);
        }
      }
    }
    this.fileChanged(state, joinPath(dir.path, listing.name));
  }

  protected forgetDir(state: RootState, path: string) {
    for (const known of Array.from(state.dirs.keys())) {
      if (known === path || known.startsWith(path + '/')) {
        const dir = state.dirs.get(known);
        clearTimeout(dir.flushTimer);
        state.dirs.delete(known);
      }
    }
    const inside = (job: Job) => job.dirPath === path || job.dirPath.startsWith(path + '/');
    state.indexQueue = state.indexQueue.filter(job => !inside(job));
    state.annotateQueue = state.annotateQueue.filter(job => !inside(job));
  }

  // ========================================
  // Live updates
  // ========================================

  protected onEvent(event: LocalFilesystemEvent) {
    const state = this.states.get(event.rootId);
    if (state == null || state.root.access !== 'granted') {
      return;
    }
    switch (event.type) {
      case 'listed': {
        const dir = state.dirs.get(event.path);
        if (dir != null) {
          dir.handle = event.handle;
          this.reconcileDir(state, dir, event.files, false);
          this.pump(state);
        } else if (state.scanning === 0) {
          // A folder that appeared since the last scan
          this.scanDir(state, event.path, event.handle, state.generation, {force: false, recursive: true})
            .catch(e => this.handleRootError(state, e));
        }
        break;
      }
      case 'opened':
        this.prioritize(encodeLocalHashId(event.rootId, event.path));
        break;
      case 'changed':
        this.refreshDir(state, parentPath(event.path), false);
        break;
      case 'removed': {
        this.forgetDir(state, event.path);
        const dir = state.dirs.get(parentPath(event.path));
        const name = baseName(event.path);
        if (dir != null) {
          dir.files.delete(name);
          this.removeJobs(state, dir.path, name);
          if (dir.shard.entries[name] != null) {
            delete dir.shard.entries[name];
            dir.annotationsChanged = true;
            this.markDirty(state, dir);
          }
        }
        this.fileChanged(state, event.path);
        this.scheduleStatus();
        break;
      }
    }
  }

  /**
   * Rescan one directory (and optionally what is below it).
   */
  protected async refreshDir(state: RootState, path: string, recursive: boolean) {
    const generation = state.generation;
    try {
      let handle = state.root.handle;
      for (const segment of splitPath(path)) {
        handle = await handle.getDirectoryHandle(segment);
      }
      await this.scanDir(state, path, handle, generation, {force: false, recursive});
    } catch (e) {
      if (e && e.name === 'NotFoundError') {
        this.forgetDir(state, path);
        this.scheduleStatus();
      } else if (generation === state.generation) {
        this.handleRootError(state, e);
      }
    }
  }

  protected onVisibilityChange() {
    if (document.visibilityState !== 'visible') {
      this.flushAll();
      return;
    }
    // Pick up changes made in other programs while Mycelium was in the background
    this.outside(() => {
      for (const state of Array.from(this.states.values())) {
        if (state.root.access === 'granted' && state.observer == null && state.scanning === 0
          && Date.now() - state.lastScanAt > RESCAN_ON_FOCUS_INTERVAL) {
          this.scan(state, false);
        }
      }
    });
  }

  /**
   * Watch the folder for changes where the browser supports it (FileSystemObserver).
   */
  protected observe(state: RootState) {
    const observerClass = typeof window !== 'undefined' ? (window as any).FileSystemObserver : undefined;
    if (observerClass == null || state.observer != null) {
      return;
    }
    try {
      const observer = new observerClass((records: any[]) => this.outside(() => this.onObserved(state, records)));
      state.observer = observer;
      Promise.resolve(observer.observe(state.root.handle, {recursive: true})).catch(() => {
        state.observer = null;
      });
    } catch (e) {
      state.observer = null;
    }
  }

  protected onObserved(state: RootState, records: any[]) {
    for (const record of records || []) {
      const components: string[] = record.relativePathComponents || [];
      // Ignore the index's own writes and other hidden files
      if (components.some(component => isHiddenName(component))) {
        continue;
      }
      if (record.type === 'unknown' || record.type === 'errored') {
        state.observedPaths.add('*');
        continue;
      }
      const path = components.join('/');
      const isDirectory = record.changedHandle && record.changedHandle.kind === 'directory';
      state.observedPaths.add(isDirectory && record.type === 'appeared' ? path + '/**' : parentPath(path));
      if (record.type === 'moved' && record.relativePathMovedFrom) {
        state.observedPaths.add(parentPath(record.relativePathMovedFrom.join('/')));
      }
    }
    clearTimeout(state.observerTimer);
    state.observerTimer = setTimeout(() => {
      const paths = Array.from(state.observedPaths);
      state.observedPaths.clear();
      if (paths.includes('*')) {
        this.scan(state, false);
        return;
      }
      for (const path of paths) {
        if (path.endsWith('/**')) {
          this.refreshDir(state, path.slice(0, -3), true);
        } else {
          this.refreshDir(state, path, false);
        }
      }
    }, 500);
  }

  // ========================================
  // Work queues
  // ========================================

  protected enqueue(state: RootState, queue: Job[], dirPath: string, name: string, priority = 0) {
    const existing = queue.find(job => job.dirPath === dirPath && job.name === name);
    if (existing != null) {
      existing.priority = Math.max(existing.priority, priority);
      return;
    }
    queue.push({dirPath, name, priority, order: this.jobCounter++});
  }

  protected hasJob(queue: Job[], dirPath: string, name: string): boolean {
    return queue.some(job => job.dirPath === dirPath && job.name === name);
  }

  protected removeJobs(state: RootState, dirPath: string, name: string) {
    const other = (job: Job) => job.dirPath !== dirPath || job.name !== name;
    state.indexQueue = state.indexQueue.filter(other);
    state.annotateQueue = state.annotateQueue.filter(other);
  }

  protected takeJob(queue: Job[]): Job | undefined {
    if (!queue.length) {
      return undefined;
    }
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].priority > queue[best].priority
        || (queue[i].priority === queue[best].priority && queue[i].order < queue[best].order)) {
        best = i;
      }
    }
    return queue.splice(best, 1)[0];
  }

  protected pump(state: RootState) {
    if (!state.indexing && state.indexQueue.length) {
      this.runIndexQueue(state);
    }
    if (!state.annotating && state.annotateQueue.length && !state.annotationSuspended && state.root.annotate) {
      this.runAnnotateQueue(state);
    }
  }

  protected async runIndexQueue(state: RootState) {
    const generation = state.generation;
    state.indexing = true;
    try {
      while (generation === state.generation) {
        const job = this.takeJob(state.indexQueue);
        if (job == null) {
          break;
        }
        await this.indexFile(state, job, generation);
        await yieldToBrowser();
      }
    } finally {
      if (generation === state.generation) {
        state.indexing = false;
        state.current = undefined;
        this.scheduleStatus();
        this.pump(state);
      }
    }
  }

  protected async runAnnotateQueue(state: RootState) {
    const generation = state.generation;
    state.annotating = true;
    try {
      while (generation === state.generation && !state.annotationSuspended && state.root.annotate) {
        const job = this.takeJob(state.annotateQueue);
        if (job == null) {
          break;
        }
        await this.annotateFile(state, job, generation);
      }
    } finally {
      if (generation === state.generation) {
        state.annotating = false;
        this.scheduleStatus();
      }
    }
  }

  protected async indexFile(state: RootState, job: Job, generation: number) {
    const dir = state.dirs.get(job.dirPath);
    const fileState = dir ? dir.files.get(job.name) : undefined;
    if (fileState == null) {
      return;
    }
    const path = joinPath(job.dirPath, job.name);
    fileState.status = {...fileState.status, state: 'indexing'};
    state.current = path;
    this.fileChanged(state, path);
    this.scheduleStatus();

    let file: File;
    try {
      file = await fileState.handle.getFile();
    } catch (e) {
      // Gone or unreadable: the next scan sorts it out
      dir.files.delete(job.name);
      this.fileChanged(state, path);
      return;
    }

    const mimeType = await this.localFilesystem.mimeTypeOf(state.root.id, path, file);
    const previous = dir.shard.entries[job.name];
    const entry: IndexEntry = {
      size: file.size,
      lastModified: file.lastModified,
      mimeType,
      state: 'skipped',
      indexer: INDEXER_VERSION,
      indexedAt: new Date().toISOString(),
    };
    try {
      const extracted = isTextIndexable(mimeType) ? await this.textExtractor(file, mimeType) : null;
      if (extracted != null) {
        const terms = countTerms(extracted.text);
        entry.state = 'indexed';
        entry.text = {
          chars: extracted.text.length,
          excerpt: makeExcerpt(extracted.text),
          terms,
        };
        if (extracted.pages != null) {
          entry.text.pages = extracted.pages;
        }
      }
    } catch (e) {
      entry.state = 'failed';
      entry.error = describeError(e);
    }
    if (generation !== state.generation) {
      return;
    }
    // Annotations of unchanged content stay valid
    if (previous != null && previous.annotations != null && matchesFingerprint(previous, file)) {
      entry.annotations = previous.annotations;
    } else if (previous != null && previous.annotations != null) {
      dir.annotationsChanged = true;
    }
    dir.shard.entries[job.name] = entry;
    fileState.size = file.size;
    fileState.lastModified = file.lastModified;
    fileState.resumed = false;
    fileState.status = this.statusOf(state, entry);
    this.markDirty(state, dir);

    if (pendingWork(entry, file, state.root.annotate, needsAnnotations) === 'annotate') {
      fileState.status = {...fileState.status, annotations: state.annotationSuspended ? 'failed' : 'queued'};
      if (!state.annotationSuspended) {
        this.enqueue(state, state.annotateQueue, job.dirPath, job.name, job.priority);
      }
    }
    this.fileChanged(state, path);
    this.pump(state);
  }

  protected async annotateFile(state: RootState, job: Job, generation: number) {
    const dir = state.dirs.get(job.dirPath);
    const fileState = dir ? dir.files.get(job.name) : undefined;
    const entry = dir ? dir.shard.entries[job.name] : undefined;
    if (fileState == null || entry == null) {
      return;
    }
    const path = joinPath(job.dirPath, job.name);
    let file: File;
    try {
      file = await fileState.handle.getFile();
    } catch (e) {
      return;
    }
    if (!matchesFingerprint(entry, file)) {
      // Changed since it was indexed; indexing it again queues the annotations again
      return;
    }
    fileState.status = {...fileState.status, annotations: 'annotating'};
    this.fileChanged(state, path);
    this.scheduleStatus();

    try {
      let annotations: Annotation[] | AnnotatedEnrichmentTable;
      let count: number;
      if (entry.mimeType === MimeTypes.EnrichmentTable) {
        annotations = await this.requestEnrichmentAnnotations(file);
        count = countEnrichmentAnnotations(annotations);
      } else {
        annotations = await this.requestAnnotations(file);
        count = annotations.length;
      }
      if (generation !== state.generation) {
        return;
      }
      const key = annotationFileName(job.name, file);
      if (state.root.writable) {
        await writeAnnotationFile(dir.handle, key, annotations);
      } else {
        this.memoryAnnotations.set(`${state.root.id}/${path}|${key}`, annotations);
      }
      if (entry.annotations != null && entry.annotations.file !== key) {
        dir.annotationsChanged = true;
      }
      entry.annotations = {state: 'done', file: key, count, date: new Date().toISOString()};
      state.annotationFailuresInRow = 0;
    } catch (e) {
      if (generation !== state.generation) {
        return;
      }
      if (isPermissionError(e)) {
        this.handleRootError(state, e);
        return;
      }
      entry.annotations = {state: 'failed', error: describeError(e), date: new Date().toISOString()};
      state.annotationFailuresInRow++;
      if (isServiceUnavailable(e) || state.annotationFailuresInRow >= MAX_ANNOTATION_FAILURES_IN_ROW) {
        // Stop sending more files for now; they are tried again on the next scan
        state.annotationSuspended = true;
        state.lastError = `Annotation paused: ${describeError(e)}`;
        this.refreshAnnotationStates(state);
      }
    }
    fileState.status = this.statusOf(state, entry);
    this.markDirty(state, dir);
    this.fileChanged(state, path);
    this.scheduleStatus();
  }

  /**
   * Whether the file is neither waiting to be (nor being) indexed or annotated, nor about to
   * be found by a scan of its folder.
   */
  protected isSettled(hashId: string): boolean {
    const status = this.getFileStatus(hashId);
    if (status != null) {
      return !(status.state === 'queued' || status.state === 'indexing'
        || status.annotations === 'queued' || status.annotations === 'annotating');
    }
    const ref = decodeLocalHashId(hashId);
    const root = ref ? this.getRootStatus(ref.rootId) : undefined;
    return root == null || root.phase === 'idle' || root.phase === 'waiting';
  }

  /**
   * What the annotation of a file found, as written to its annotation file; undefined if the
   * file has not been annotated (yet).
   */
  protected async readStoredAnnotations(hashId: string): Promise<any> {
    const resolved = await this.localFilesystem.resolve(hashId);
    if (resolved.handle.kind !== 'file' || resolved.parent == null) {
      return undefined;
    }
    const file = await resolved.handle.getFile();
    const dirPath = parentPath(resolved.ref.path);
    const state = this.states.get(resolved.root.id);
    const dir = state ? state.dirs.get(dirPath) : undefined;
    const shard = dir ? dir.shard : await readShard(resolved.parent).catch(() => null);
    const entry = shard ? shard.entries[file.name] : undefined;
    if (entry == null || !matchesFingerprint(entry, file) || entry.annotations == null
      || entry.annotations.state !== 'done') {
      return undefined;
    }
    const memory = this.memoryAnnotations.get(`${resolved.root.id}/${resolved.ref.path}|${entry.annotations.file}`);
    if (memory != null) {
      return memory;
    }
    const stored = await readAnnotationFile(resolved.parent, entry.annotations.file).catch(() => null);
    return stored == null ? undefined : stored;
  }

  protected async requestAnnotations(file: File): Promise<Annotation[]> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('filename', file.name);
    const response = await firstValueFrom(this.http.post<{ results: Annotation[] }>(
      '/api/filesystem/annotations/transient', form, this.apiService.getHttpOptions(true)));
    return response && Array.isArray(response.results) ? response.results : [];
  }

  protected async requestEnrichmentAnnotations(file: File): Promise<AnnotatedEnrichmentTable> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('filename', file.name);
    const response = await firstValueFrom(this.http.post<{ results: AnnotatedEnrichmentTable }>(
      '/api/filesystem/annotations/transient/enrichment-table', form, this.apiService.getHttpOptions(true)));
    if (response == null || !isWellFormedEnrichmentTable(response.results)) {
      throw new Error('The annotated enrichment table is not in the expected format.');
    }
    return response.results;
  }

  // ========================================
  // Persistence
  // ========================================

  protected markDirty(state: RootState, dir: DirState) {
    dir.dirty = true;
    if (!state.root.writable) {
      return;
    }
    const now = Date.now();
    if (!dir.firstDirtyAt) {
      dir.firstDirtyAt = now;
    }
    clearTimeout(dir.flushTimer);
    const delay = now - dir.firstDirtyAt >= FLUSH_MAX_WAIT ? 0 : FLUSH_DELAY;
    dir.flushTimer = setTimeout(() => this.flush(state, dir), delay);
  }

  protected flush(state: RootState, dir: DirState): Promise<void> {
    clearTimeout(dir.flushTimer);
    dir.flushTimer = null;
    if (!dir.dirty || !state.root.writable || state.root.access !== 'granted') {
      return dir.writing;
    }
    dir.dirty = false;
    dir.firstDirtyAt = 0;
    const hasEntries = Object.keys(dir.shard.entries).length > 0;
    if (!hasEntries && !dir.onDisk) {
      return dir.writing;
    }
    const snapshot = JSON.parse(JSON.stringify(dir.shard));
    const cleanAnnotations = dir.annotationsChanged;
    dir.annotationsChanged = false;
    dir.writing = dir.writing.then(async () => {
      try {
        await writeShard(dir.handle, snapshot);
        dir.onDisk = true;
        if (cleanAnnotations) {
          const keep = new Set<string>();
          for (const entry of Object.values<IndexEntry>(snapshot.entries)) {
            if (entry.annotations && entry.annotations.file) {
              keep.add(entry.annotations.file);
            }
          }
          await removeAnnotationFiles(dir.handle, keep);
        }
      } catch (e) {
        dir.dirty = true;
        if (isPermissionError(e)) {
          this.handleRootError(state, e);
        } else {
          state.lastError = `Could not save the index of "${dir.path || state.root.name}": ${describeError(e)}`;
          this.scheduleStatus();
        }
      }
    });
    return dir.writing;
  }

  protected handleRootError(state: RootState, error: any) {
    state.lastError = describeError(error);
    if (isPermissionError(error)) {
      this.ngZone.run(() => this.registry.markLost(state.root.id, error));
    } else {
      // The folder itself may have been moved or deleted
      state.root.handle.values().next()
        .catch(rootError => this.ngZone.run(() => this.registry.markLost(state.root.id, rootError)));
    }
    this.scheduleStatus();
  }

  // ========================================
  // Status
  // ========================================

  protected annotationStateOf(state: RootState, entry: IndexEntry | undefined): LocalAnnotationState {
    if (entry != null && entry.annotations != null && entry.annotations.state === 'done') {
      return 'done';
    }
    if (!state.root.annotate) {
      return 'off';
    }
    if (entry != null && entry.annotations != null) {
      return entry.annotations.state;
    }
    return state.annotationSuspended ? 'failed' : 'queued';
  }

  protected statusOf(state: RootState, entry: IndexEntry): LocalFileIndexStatus {
    const status: LocalFileIndexStatus = {
      state: entry.state,
      annotations: entry.state === 'indexed' && needsAnnotations(entry.mimeType, entry.size)
        ? this.annotationStateOf(state, entry)
        : 'not-applicable',
      indexedAt: entry.indexedAt,
    };
    if (entry.text != null) {
      status.terms = Object.keys(entry.text.terms || {}).length;
      if (entry.text.pages != null) {
        status.pages = entry.text.pages;
      }
    }
    if (entry.error) {
      status.error = entry.error;
    }
    if (entry.annotations != null) {
      if (entry.annotations.count != null) {
        status.annotationCount = entry.annotations.count;
      }
      if (entry.annotations.error) {
        status.annotationError = entry.annotations.error;
      }
    }
    return status;
  }

  /**
   * Update the annotation part of every file's status after the folder's settings changed.
   */
  protected refreshAnnotationStates(state: RootState) {
    if (!state.root.annotate || state.annotationSuspended) {
      state.annotateQueue = [];
    }
    for (const dir of Array.from(state.dirs.values())) {
      for (const file of Array.from(dir.files.values())) {
        const entry = dir.shard.entries[file.name];
        if (entry != null && file.status.state !== 'queued' && file.status.state !== 'indexing') {
          file.status = this.statusOf(state, entry);
          this.fileChanged(state, joinPath(dir.path, file.name));
        }
      }
    }
    this.scheduleStatus();
  }

  protected computeStatus(state: RootState): LocalRootIndexStatus {
    const status: LocalRootIndexStatus = {
      rootId: state.root.id,
      phase: 'idle',
      files: 0,
      indexed: 0,
      skipped: 0,
      failed: 0,
      queued: 0,
      annotationsQueued: 0,
      annotated: 0,
      annotationsFailed: 0,
      resumed: 0,
      persisted: state.root.writable,
    };
    for (const dir of Array.from(state.dirs.values())) {
      for (const file of Array.from(dir.files.values())) {
        status.files++;
        switch (file.status.state) {
          case 'indexed':
            status.indexed++;
            break;
          case 'skipped':
            status.skipped++;
            break;
          case 'failed':
            status.failed++;
            break;
          default:
            status.queued++;
        }
        switch (file.status.annotations) {
          case 'queued':
          case 'annotating':
            status.annotationsQueued++;
            break;
          case 'done':
            status.annotated++;
            break;
          case 'failed':
            status.annotationsFailed++;
            break;
        }
        if (file.resumed) {
          status.resumed++;
        }
      }
    }
    if (state.root.access !== 'granted') {
      status.phase = 'waiting';
    } else if (state.indexing || state.indexQueue.length || state.annotating
      || (state.annotateQueue.length && !state.annotationSuspended && state.root.annotate)) {
      status.phase = 'indexing';
    } else if (state.scanning > 0) {
      status.phase = 'scanning';
    }
    if (state.current != null && status.phase === 'indexing') {
      status.current = state.current;
    }
    if (state.lastError != null) {
      status.lastError = state.lastError;
    }
    return status;
  }

  protected scheduleStatus() {
    if (this.statusTimer != null) {
      return;
    }
    this.statusTimer = setTimeout(() => {
      this.statusTimer = null;
      const statuses = new Map<string, LocalRootIndexStatus>();
      for (const state of Array.from(this.states.values())) {
        statuses.set(state.root.id, this.computeStatus(state));
      }
      const changedFiles = Array.from(this.pendingFileChanges);
      this.pendingFileChanges.clear();
      // One change detection round for everything that happened since the last update
      this.ngZone.run(() => {
        this.statusSubject.next(statuses);
        for (const hashId of changedFiles) {
          this.fileChanges.next(hashId);
        }
      });
    }, STATUS_THROTTLE);
  }

  protected fileChanged(state: RootState, path: string) {
    this.pendingFileChanges.add(encodeLocalHashId(state.root.id, path));
    this.scheduleStatus();
  }

  protected locate(hashId: string): { state: RootState, dir?: DirState, file?: FileState } | null {
    const ref = decodeLocalHashId(hashId);
    const state = ref ? this.states.get(ref.rootId) : undefined;
    if (state == null) {
      return null;
    }
    const dir = state.dirs.get(parentPath(ref.path));
    return {state, dir, file: dir ? dir.files.get(baseName(ref.path)) : undefined};
  }

  protected outside(fn: () => void) {
    this.ngZone.runOutsideAngular(fn);
  }
}

export function isWellFormedAnnotation(annotation: any): annotation is Annotation {
  return annotation != null && typeof annotation === 'object'
    && annotation.meta != null && typeof annotation.meta === 'object'
    && typeof annotation.meta.type === 'string' && typeof annotation.meta.id === 'string'
    && typeof annotation.pageNumber === 'number'
    && Array.isArray(annotation.rects) && annotation.rects.every(rect => Array.isArray(rect)
      && rect.length === 4 && rect.every(value => typeof value === 'number'))
    && Array.isArray(annotation.keywords);
}

export function needsAnnotations(mimeType: string, size: number): boolean {
  return (mimeType === MimeTypes.Pdf && size <= MAX_ANNOTATED_PDF_BYTES)
    || (mimeType === MimeTypes.EnrichmentTable && size <= MAX_ANNOTATED_ENRICHMENT_TABLE_BYTES);
}

export function isWellFormedEnrichmentTable(table: any): table is AnnotatedEnrichmentTable {
  return table != null && typeof table === 'object' && !Array.isArray(table)
    && table.result != null && typeof table.result === 'object' && Array.isArray(table.result.genes);
}

/**
 * The number of entities highlighted in the cells of an annotated enrichment table.
 */
export function countEnrichmentAnnotations(table: AnnotatedEnrichmentTable): number {
  return (JSON.stringify(table.result).match(/<annotation[\s>]/g) || []).length;
}

/**
 * Score a shard entry against search terms; null if a term does not occur.
 */
export function scoreEntry(terms: string[], name: string, entry: IndexEntry):
  { score: number, matches: { [term: string]: number } } | null {
  const nameTerms = tokenize(name);
  const textTerms = entry.text ? entry.text.terms || {} : {};
  const matches: { [term: string]: number } = {};
  let score = 0;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const isLast = i === terms.length - 1;
    const count = textTerms[term] || 0;
    const inName = nameTerms.some(nameTerm => nameTerm === term || (isLast && nameTerm.startsWith(term)));
    if (!count && !inName) {
      return null;
    }
    matches[term] = count;
    score += Math.log(1 + count) + (inName ? 3 : 0);
  }
  return {score, matches};
}

export function summarize(statuses: LocalRootIndexStatus[]): LocalIndexSummary {
  const summary: LocalIndexSummary = {
    roots: statuses.length,
    active: false,
    files: 0,
    done: 0,
    queued: 0,
    annotationsQueued: 0,
    waiting: 0,
  };
  for (const status of statuses) {
    if (status.phase === 'waiting') {
      summary.waiting++;
      continue;
    }
    summary.active = summary.active || status.phase === 'indexing' || status.phase === 'scanning';
    summary.files += status.files;
    summary.done += status.indexed + status.skipped + status.failed;
    summary.queued += status.queued;
    summary.annotationsQueued += status.annotationsQueued;
  }
  return summary;
}

function describeError(error: any): string {
  if (error instanceof HttpErrorResponse) {
    const message = error.error && typeof error.error === 'object' && error.error.message;
    return message || `${error.status} ${error.statusText || 'Server error'}`;
  }
  if (error && error.message) {
    return error.message;
  }
  return String(error);
}

function isServiceUnavailable(error: any): boolean {
  return error instanceof HttpErrorResponse
    && (error.status === 0 || error.status === 404 || error.status === 405 || error.status >= 502);
}

function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
