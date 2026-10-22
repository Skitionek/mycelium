import { Inject, Injectable, NgZone } from '@angular/core';

import { BehaviorSubject, Observable } from 'rxjs';

import {
  isFileSystemAccessSupported,
  isNotFoundError,
  LocalDirectoryHandle,
  LocalPermissionMode,
  LocalPermissionState,
  pickDirectory,
} from '../fs-types';
import { generateRootId } from '../local-ids';
import { MANIFEST_FORMAT, readManifest, SHARD_VERSION, writeManifest } from '../index-shard';
import {
  notConnectedError,
  permissionError,
  readOnlyError,
  unavailableError,
} from '../local-folder-errors';
import { LOCAL_ROOT_STORE, LocalRootStore, StoredLocalRoot } from '../local-root-store';

/**
 * - granted: Mycelium can read the folder (and write to it if {@link LocalRoot.writable})
 * - prompt: access has to be granted again, which needs a click (typically after a reload)
 * - denied: the user refused access
 * - unavailable: the folder no longer exists where it was
 */
export type LocalRootAccess = 'granted' | 'prompt' | 'denied' | 'unavailable';

export interface LocalRoot extends StoredLocalRoot {
  access: LocalRootAccess;
  writable: boolean;
}

/**
 * Keeps track of the local folders connected to Mycelium: remembers them across reloads,
 * manages their permissions and gives each one a stable identity.
 *
 * A folder's identity is written into its own hidden manifest (see index-shard.ts), so
 * disconnecting a folder and connecting it again - even after clearing the browser's
 * storage - gives it back the same ID. Hash IDs of its files, links to them and the
 * index built so far therefore all keep working.
 */
@Injectable({providedIn: 'root'})
export class LocalFolderRegistry {
  readonly supported = isFileSystemAccessSupported();
  private readonly rootsSubject = new BehaviorSubject<LocalRoot[]>([]);
  readonly roots$: Observable<LocalRoot[]> = this.rootsSubject.asObservable();
  readonly ready: Promise<void>;

  constructor(@Inject(LOCAL_ROOT_STORE) protected readonly store: LocalRootStore,
              protected readonly ngZone: NgZone) {
    this.ready = this.load();
  }

  get roots(): LocalRoot[] {
    return this.rootsSubject.value;
  }

  getRoot(id: string): LocalRoot | undefined {
    return this.roots.find(root => root.id === id);
  }

  /**
   * Connect a folder, asking the user to pick one when no handle is given. A folder that was
   * connected before (here, or anywhere its hidden manifest was written) keeps its ID.
   */
  async connect(handle?: LocalDirectoryHandle): Promise<LocalRoot> {
    if (handle == null) {
      handle = await pickDirectory();
    }
    await this.ready;

    const permission = await this.requestAccess(handle);
    if (permission.access !== 'granted') {
      throw permissionError(handle.name);
    }

    for (const existing of this.roots) {
      if (await existing.handle.isSameEntry(handle).catch(() => false)) {
        return this.update({...existing, handle, ...permission});
      }
    }

    const manifest = await readManifest(handle).catch(() => null);
    let id = generateRootId();
    if (manifest != null) {
      const holder = this.getRoot(manifest.rootId);
      // The ID is reused unless another live folder has it, which happens when a connected
      // folder was copied together with its index
      if (holder == null || !(await this.isReachable(holder))) {
        id = manifest.rootId;
      }
    }

    const root: LocalRoot = {
      id,
      name: handle.name,
      handle,
      addedAt: new Date().toISOString(),
      annotate: manifest != null && manifest.annotate != null ? manifest.annotate : true,
      ...permission,
    };
    if (root.writable && (manifest == null || manifest.rootId !== id || manifest.name !== root.name)) {
      await this.writeRootManifest(root, manifest != null && manifest.rootId === id ? manifest.createdAt : null);
    }
    return this.update(root);
  }

  /**
   * Ask for access to a known folder again. Must be called from a user gesture.
   */
  async reconnect(id: string): Promise<LocalRoot> {
    await this.ready;
    const root = this.getRoot(id);
    if (root == null) {
      throw notConnectedError();
    }
    const permission = await this.requestAccess(root.handle);
    const updated = {...root, ...permission};
    if (updated.access === 'granted' && !(await this.isReachable(updated))) {
      updated.access = 'unavailable';
    }
    if (updated.access === 'granted' && updated.writable) {
      const manifest = await readManifest(root.handle).catch(() => null);
      if (manifest == null || manifest.rootId !== root.id) {
        await this.writeRootManifest(updated, null).catch(() => undefined);
      }
    }
    return this.update(updated);
  }

  async disconnect(id: string): Promise<void> {
    await this.ready;
    await this.store.delete(id);
    this.emit(this.roots.filter(root => root.id !== id));
  }

  async setAnnotate(id: string, annotate: boolean): Promise<LocalRoot> {
    await this.ready;
    const root = this.getRoot(id);
    if (root == null) {
      throw notConnectedError();
    }
    const updated = {...root, annotate};
    if (updated.access === 'granted' && updated.writable) {
      const manifest = await readManifest(root.handle).catch(() => null);
      await this.writeRootManifest(updated, manifest ? manifest.createdAt : null).catch(() => undefined);
    }
    return this.update(updated);
  }

  /**
   * Get a folder that is ready to be used, requesting access if the browser allows it at
   * this point (it does within a short time of a click).
   * @throws LocalFolderError if the folder cannot be used
   */
  async ensureAccess(id: string, write = false): Promise<LocalRoot> {
    await this.ready;
    let root = this.getRoot(id);
    if (root == null) {
      throw notConnectedError();
    }
    if (root.access === 'prompt') {
      try {
        root = await this.reconnect(id);
      } catch (e) {
        throw permissionError(root.name, e);
      }
    }
    if (root.access === 'unavailable') {
      throw unavailableError(root.name);
    }
    if (root.access !== 'granted') {
      throw permissionError(root.name);
    }
    if (write && !root.writable) {
      throw readOnlyError(root.name);
    }
    return root;
  }

  /**
   * Record that a folder turned out to be gone or inaccessible while using it.
   */
  markLost(id: string, error: any) {
    const root = this.getRoot(id);
    if (root != null && root.access === 'granted') {
      this.emit(this.roots.map(item => item.id === id
        ? {...item, access: isNotFoundError(error) ? 'unavailable' : 'prompt', writable: false}
        : item));
    }
  }

  protected async load(): Promise<void> {
    let stored: StoredLocalRoot[] = [];
    try {
      stored = await this.store.list();
    } catch (e) {
      stored = [];
    }
    const roots = await Promise.all(stored.map(async item => {
      const root: LocalRoot = {...item, ...(await this.queryAccess(item.handle))};
      if (root.access === 'granted' && !(await this.isReachable(root))) {
        root.access = 'unavailable';
        root.writable = false;
      }
      return root;
    }));
    roots.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    this.emit(roots);
  }

  protected async update(root: LocalRoot): Promise<LocalRoot> {
    const {access, writable, ...stored} = root;
    await this.store.put(stored);
    const roots = this.roots.some(item => item.id === root.id)
      ? this.roots.map(item => item.id === root.id ? root : item)
      : [...this.roots, root];
    this.emit(roots);
    return root;
  }

  protected emit(roots: LocalRoot[]) {
    this.ngZone.run(() => this.rootsSubject.next(roots));
  }

  protected async writeRootManifest(root: LocalRoot, createdAt: string | null) {
    await writeManifest(root.handle, {
      format: MANIFEST_FORMAT,
      version: SHARD_VERSION,
      rootId: root.id,
      name: root.name,
      createdAt: createdAt || new Date().toISOString(),
      annotate: root.annotate,
    });
  }

  protected async isReachable(root: LocalRoot): Promise<boolean> {
    if (root.access !== 'granted') {
      return false;
    }
    try {
      await root.handle.values().next();
      return true;
    } catch (e) {
      return false;
    }
  }

  protected async queryAccess(handle: LocalDirectoryHandle): Promise<Pick<LocalRoot, 'access' | 'writable'>> {
    return this.resolveAccess(mode => handle.queryPermission ? handle.queryPermission({mode}) : Promise.resolve('granted'));
  }

  protected async requestAccess(handle: LocalDirectoryHandle): Promise<Pick<LocalRoot, 'access' | 'writable'>> {
    return this.resolveAccess(mode => handle.requestPermission ? handle.requestPermission({mode}) : Promise.resolve('granted'));
  }

  private async resolveAccess(check: (mode: LocalPermissionMode) => Promise<LocalPermissionState>):
    Promise<Pick<LocalRoot, 'access' | 'writable'>> {
    const readWrite = await check('readwrite');
    if (readWrite === 'granted') {
      return {access: 'granted', writable: true};
    }
    const read = await check('read');
    if (read === 'granted') {
      return {access: 'granted', writable: false};
    }
    return {access: read === 'denied' && readWrite === 'denied' ? 'denied' : 'prompt', writable: false};
  }
}
