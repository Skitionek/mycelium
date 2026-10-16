import { Injectable } from '@angular/core';

import { Observable, Subscriber } from 'rxjs';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from './filesystem.service';

/**
 * Where the server bundles serverless-office-converter (see client/Dockerfile).
 */
export const OFFICE_CONVERTER_PATH = 'office-converter/';

/**
 * Largest office file that is downloaded to render a thumbnail.
 */
export const OFFICE_THUMBNAIL_MAX_SIZE = 25 * 1024 * 1024;

/**
 * The engine is stopped, releasing its memory, after this long without thumbnails to render.
 */
export const OFFICE_ENGINE_IDLE_MS = 60 * 1000;

const MAX_REMEMBERED_THUMBNAILS = 500;

/**
 * OfficeEngine of serverless-office-converter (the part of its API used here).
 */
interface OfficeEngine {
  start(): Promise<void>;
  stop(reason: string): void;
  convertFile(file: Blob, targetId: string, options: { name: string, priority: number, quiet: boolean }):
    Promise<{ blob: Blob }>;
}

interface RenderJob {
  key: string;
  object: FilesystemObject;
  priority: number;
  seq: number;
  subscribers: Set<Subscriber<Blob>>;
  started: boolean;
  cancelDownload?: () => void;
}

const CANCELLED = new Error('Cancelled.');

function whenIdle(): Promise<void> {
  return new Promise(resolve => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(), {timeout: 2000});
    } else {
      setTimeout(resolve, 100);
    }
  });
}

/**
 * Optional thumbnails of office files, rendered in the browser by serverless-office-converter
 * (LibreOffice compiled to WebAssembly, running in a Web Worker).
 *
 * They are switched on by the server (OFFICE_THUMBNAILS=on, see client/nginx.conf), which
 * bundles the converter and makes the page cross-origin isolated. Otherwise nothing changes:
 * file type icons are shown and nothing is loaded.
 *
 * Thumbnails must never hold up the rest of the application:
 * - Nothing is loaded until a thumbnail that has not been rendered yet is on screen. Only then
 *   are the converter's scripts loaded, and its engine (about 30 MB, cached by the browser)
 *   started.
 * - One file at a time is downloaded and converted, and only once the browser is idle, so
 *   thumbnails use at most one of the browser's connections to the server and one conversion's
 *   worth of CPU, off the main thread.
 * - Requests for thumbnails that have left the screen are dropped; a download in progress is
 *   aborted.
 * - The engine is stopped after {@link OFFICE_ENGINE_IDLE_MS} without work, and given up on
 *   for the session if it cannot start.
 * - Each version of a file is rendered once per session.
 */
@Injectable({
  providedIn: 'root',
})
export class OfficeThumbnailService {
  private engine: Promise<OfficeEngine | null> = null;
  private unavailable = false;
  /**
   * Rendered thumbnails (PNG) by file version, or null where rendering failed.
   */
  private readonly thumbnails = new Map<string, Blob | null>();
  private readonly jobs = new Map<string, RenderJob>();
  private running = false;
  private seq = 0;
  private idleTimer: ReturnType<typeof setTimeout> = null;
  protected engineIdleMs = OFFICE_ENGINE_IDLE_MS;

  constructor(protected readonly filesystemService: FilesystemService) {
  }

  /**
   * Whether a thumbnail may be shown for the object. Loads nothing.
   */
  handles(object: FilesystemObject): boolean {
    return !this.unavailable
      && window.crossOriginIsolated === true
      && object != null && object.isFile && object.isLibreOfficeConvertible
      && this.thumbnails.get(this.key(object)) !== null;
  }

  /**
   * The thumbnail already rendered for this version of the file, if any.
   */
  getRendered(object: FilesystemObject): Blob | undefined {
    return this.thumbnails.get(this.key(object)) || undefined;
  }

  /**
   * The thumbnail (PNG) of the file, rendered when it is its turn (higher priority first).
   * Unsubscribe as soon as it is no longer needed, e.g. when it leaves the screen.
   */
  thumbnail(object: FilesystemObject, priority = 0): Observable<Blob> {
    return new Observable<Blob>(subscriber => {
      const key = this.key(object);
      const rendered = this.thumbnails.get(key);
      if (rendered) {
        subscriber.next(rendered);
        subscriber.complete();
        return;
      }
      if (rendered === null || this.unavailable) {
        subscriber.error(new Error('No thumbnail available.'));
        return;
      }
      let job = this.jobs.get(key);
      if (job == null) {
        job = {key, object, priority, seq: this.seq++, subscribers: new Set(), started: false};
        this.jobs.set(key, job);
      }
      job.priority = Math.max(job.priority, priority);
      job.subscribers.add(subscriber);
      this.pump();
      return () => {
        job.subscribers.delete(subscriber);
        if (job.subscribers.size === 0) {
          if (!job.started) {
            this.jobs.delete(key);
          } else if (job.cancelDownload) {
            // A conversion already under way is finished, and its result remembered.
            job.cancelDownload();
          }
        }
      };
    });
  }

  private key(object: FilesystemObject) {
    return `${object.hashId} ${object.modifiedDate}`;
  }

  private remember(key: string, thumbnail: Blob | null) {
    this.thumbnails.delete(key);
    this.thumbnails.set(key, thumbnail);
    if (this.thumbnails.size > MAX_REMEMBERED_THUMBNAILS) {
      this.thumbnails.delete(this.thumbnails.keys().next().value);
    }
  }

  private async pump() {
    if (this.running) {
      return;
    }
    this.running = true;
    clearTimeout(this.idleTimer);
    try {
      while (this.jobs.size) {
        await whenIdle();
        let next: RenderJob = null;
        for (const job of this.jobs.values()) {
          if (next == null || job.priority > next.priority || (job.priority === next.priority && job.seq < next.seq)) {
            next = job;
          }
        }
        if (next != null) {
          await this.render(next);
        }
      }
    } finally {
      this.running = false;
      this.idleTimer = setTimeout(() => this.stopEngine(), this.engineIdleMs);
    }
  }

  private async render(job: RenderJob) {
    job.started = true;
    try {
      const engine = await this.loadEngine();
      if (engine == null) {
        throw new Error('Office thumbnails are not available.');
      }
      const content = await this.download(job);
      const {blob} = await engine.convertFile(content, 'png', {
        name: job.object.filename, priority: -10, quiet: true,
      });
      this.remember(job.key, blob);
      job.subscribers.forEach(subscriber => {
        subscriber.next(blob);
        subscriber.complete();
      });
    } catch (error) {
      if (error !== CANCELLED) {
        if (!this.unavailable) {
          this.remember(job.key, null);
        }
        job.subscribers.forEach(subscriber => subscriber.error(error));
      }
    } finally {
      this.jobs.delete(job.key);
    }
  }

  private download(job: RenderJob): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const subscription = this.filesystemService.getContentUpTo(job.object.hashId, OFFICE_THUMBNAIL_MAX_SIZE)
        .subscribe({next: resolve, error: reject});
      job.cancelDownload = () => {
        subscription.unsubscribe();
        reject(CANCELLED);
      };
    }).finally(() => job.cancelDownload = null);
  }

  /**
   * The converter's engine, started; null (for the rest of the session) if it is not bundled
   * or cannot run in this browser.
   */
  private async loadEngine(): Promise<OfficeEngine | null> {
    if (this.engine == null) {
      const base = new URL(OFFICE_CONVERTER_PATH, document.baseURI).href;
      this.engine = import(/* webpackIgnore: true */ `${base}office-engine.js`)
        .then(({OfficeEngine: Engine}) => new Engine({base}) as OfficeEngine)
        .catch(error => {
          console.warn('Office thumbnails are not available:', error);
          this.unavailable = true;
          return null;
        });
    }
    const engine = await this.engine;
    try {
      await engine?.start();
    } catch (error) {
      console.warn('Office thumbnails are not available:', error);
      this.unavailable = true;
      return null;
    }
    return engine;
  }

  private stopEngine() {
    if (!this.running && this.engine != null) {
      this.engine.then(engine => engine?.stop('Stopped while there were no thumbnails to render.'));
    }
  }
}
