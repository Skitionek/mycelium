import { InjectionToken } from '@angular/core';

import { LocalDirectoryHandle } from './fs-types';

/**
 * What is remembered about a connected folder between sessions. Directory handles can be
 * stored in IndexedDB, which is what lets a folder come back after a reload with a single
 * "Reconnect" click instead of being picked again.
 */
export interface StoredLocalRoot {
  id: string;
  name: string;
  handle: LocalDirectoryHandle;
  addedAt: string;
  annotate: boolean;
}

export interface LocalRootStore {
  list(): Promise<StoredLocalRoot[]>;

  put(root: StoredLocalRoot): Promise<void>;

  delete(id: string): Promise<void>;
}

const DB_NAME = 'mycelium-local-folders';
const DB_VERSION = 1;
const STORE_NAME = 'roots';

export class IndexedDbLocalRootStore implements LocalRootStore {
  private db: Promise<IDBDatabase | null> | null = null;

  async list(): Promise<StoredLocalRoot[]> {
    const db = await this.open();
    if (db == null) {
      return [];
    }
    return this.request<StoredLocalRoot[]>(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
  }

  async put(root: StoredLocalRoot): Promise<void> {
    const db = await this.open();
    if (db != null) {
      await this.request(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(root));
    }
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    if (db != null) {
      await this.request(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
    }
  }

  private open(): Promise<IDBDatabase | null> {
    if (this.db == null) {
      this.db = new Promise(resolve => {
        if (typeof indexedDB === 'undefined') {
          resolve(null);
          return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, {keyPath: 'id'});
          }
        };
        request.onsuccess = () => resolve(request.result);
        // Private browsing and blocked storage: folders still work, they are just not remembered
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
    }
    return this.db;
  }

  private request<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export class MemoryLocalRootStore implements LocalRootStore {
  readonly roots = new Map<string, StoredLocalRoot>();

  async list(): Promise<StoredLocalRoot[]> {
    return Array.from(this.roots.values());
  }

  async put(root: StoredLocalRoot): Promise<void> {
    this.roots.set(root.id, {...root});
  }

  async delete(id: string): Promise<void> {
    this.roots.delete(id);
  }
}

export const LOCAL_ROOT_STORE = new InjectionToken<LocalRootStore>('localRootStore', {
  providedIn: 'root',
  factory: () => new IndexedDbLocalRootStore(),
});
