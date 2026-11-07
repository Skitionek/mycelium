import {
  LocalDirectoryHandle,
  LocalFileHandle,
  LocalHandle,
  LocalHandleBase,
  LocalPermissionState,
  LocalWritable,
} from '../fs-types';

/**
 * An in-memory stand-in for File System Access API handles, for unit tests.
 */

function domError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export class MemoryFileHandle implements LocalFileHandle {
  readonly kind = 'file';
  data: Blob;
  lastModified: number;
  permission: LocalPermissionState = 'granted';
  writes = 0;

  constructor(public name: string, content: string | Blob = '', lastModified = 1_700_000_000_000) {
    this.data = content instanceof Blob ? content : new Blob([content]);
    this.lastModified = lastModified;
  }

  async isSameEntry(other: LocalHandleBase): Promise<boolean> {
    return other === this;
  }

  async getFile(): Promise<File> {
    return new File([this.data], this.name, {lastModified: this.lastModified});
  }

  async createWritable(): Promise<LocalWritable> {
    const parts: (Blob | BufferSource | string)[] = [];
    return {
      write: async (data) => {
        parts.push(data);
      },
      close: async () => {
        this.data = new Blob(parts as BlobPart[]);
        this.lastModified += 1000;
        this.writes++;
      },
      abort: async () => {
      },
    };
  }

  setContent(content: string, lastModified = this.lastModified + 1000) {
    this.data = new Blob([content]);
    this.lastModified = lastModified;
  }
}

export class MemoryDirectoryHandle implements LocalDirectoryHandle {
  readonly kind = 'directory';
  readonly children = new Map<string, MemoryFileHandle | MemoryDirectoryHandle>();
  permission: LocalPermissionState = 'granted';
  readPermission: LocalPermissionState = 'granted';

  constructor(public name: string) {
  }

  async isSameEntry(other: LocalHandleBase): Promise<boolean> {
    return other === this;
  }

  async queryPermission(descriptor?: { mode?: string }): Promise<LocalPermissionState> {
    return descriptor && descriptor.mode === 'readwrite' ? this.permission : this.readPermission;
  }

  async requestPermission(descriptor?: { mode?: string }): Promise<LocalPermissionState> {
    return this.queryPermission(descriptor);
  }

  async* values(): AsyncIterableIterator<LocalHandle> {
    for (const child of Array.from(this.children.values())) {
      yield child;
    }
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<MemoryFileHandle> {
    const existing = this.children.get(name);
    if (existing instanceof MemoryFileHandle) {
      return existing;
    }
    if (existing != null) {
      throw domError('TypeMismatchError', `${name} is a directory`);
    }
    if (!options.create) {
      throw domError('NotFoundError', `${name} not found`);
    }
    this.assertWritable();
    const created = new MemoryFileHandle(name);
    this.children.set(name, created);
    return created;
  }

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<MemoryDirectoryHandle> {
    const existing = this.children.get(name);
    if (existing instanceof MemoryDirectoryHandle) {
      return existing;
    }
    if (existing != null) {
      throw domError('TypeMismatchError', `${name} is a file`);
    }
    if (!options.create) {
      throw domError('NotFoundError', `${name} not found`);
    }
    this.assertWritable();
    const created = new MemoryDirectoryHandle(name);
    created.permission = this.permission;
    this.children.set(name, created);
    return created;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.children.has(name)) {
      throw domError('NotFoundError', `${name} not found`);
    }
    this.assertWritable();
    this.children.delete(name);
  }

  // Test helpers

  file(name: string, content: string | Blob = '', lastModified?: number): MemoryFileHandle {
    const handle = new MemoryFileHandle(name, content, lastModified);
    this.children.set(name, handle);
    return handle;
  }

  dir(name: string): MemoryDirectoryHandle {
    const handle = new MemoryDirectoryHandle(name);
    handle.permission = this.permission;
    this.children.set(name, handle);
    return handle;
  }

  at(path: string): MemoryFileHandle | MemoryDirectoryHandle | undefined {
    let current: MemoryFileHandle | MemoryDirectoryHandle = this;
    for (const segment of path.split('/').filter(s => s.length)) {
      if (!(current instanceof MemoryDirectoryHandle)) {
        return undefined;
      }
      current = current.children.get(segment);
      if (current == null) {
        return undefined;
      }
    }
    return current;
  }

  async readText(path: string): Promise<string | undefined> {
    const handle = this.at(path);
    return handle instanceof MemoryFileHandle ? handle.data.text() : undefined;
  }

  private assertWritable() {
    if (this.permission !== 'granted') {
      throw domError('NotAllowedError', 'Write permission not granted');
    }
  }
}
