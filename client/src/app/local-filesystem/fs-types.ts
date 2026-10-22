/**
 * Minimal typings for the parts of the File System Access API that local folders use.
 *
 * The permission and picker methods are WICG extensions that TypeScript's DOM library does
 * not ship, so the handles are described here structurally. Real browser handles satisfy
 * these interfaces, and so does the in-memory implementation used by the unit tests.
 */

export type LocalPermissionMode = 'read' | 'readwrite';
export type LocalPermissionState = 'granted' | 'denied' | 'prompt';

export interface LocalHandleBase {
  readonly kind: 'file' | 'directory';
  readonly name: string;

  isSameEntry(other: LocalHandleBase): Promise<boolean>;

  queryPermission?(descriptor?: { mode?: LocalPermissionMode }): Promise<LocalPermissionState>;

  requestPermission?(descriptor?: { mode?: LocalPermissionMode }): Promise<LocalPermissionState>;
}

export interface LocalWritable {
  write(data: Blob | BufferSource | string): Promise<void>;

  close(): Promise<void>;

  abort?(): Promise<void>;
}

export interface LocalFileHandle extends LocalHandleBase {
  readonly kind: 'file';

  getFile(): Promise<File>;

  createWritable(options?: { keepExistingData?: boolean }): Promise<LocalWritable>;

  /**
   * Rename and/or move the entry. Not available in every browser.
   */
  move?(destinationOrName: LocalDirectoryHandle | string, name?: string): Promise<void>;
}

export interface LocalDirectoryHandle extends LocalHandleBase {
  readonly kind: 'directory';

  values(): AsyncIterableIterator<LocalFileHandle | LocalDirectoryHandle>;

  getFileHandle(name: string, options?: { create?: boolean }): Promise<LocalFileHandle>;

  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<LocalDirectoryHandle>;

  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;

  move?(destinationOrName: LocalDirectoryHandle | string, name?: string): Promise<void>;
}

export type LocalHandle = LocalFileHandle | LocalDirectoryHandle;

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

/**
 * Ask the user to pick a directory. Must be called from a user gesture.
 */
export function pickDirectory(): Promise<LocalDirectoryHandle> {
  return (window as any).showDirectoryPicker({
    id: 'mycelium-local-folder',
    mode: 'readwrite',
  });
}

/**
 * Extract directory handles from a drop event, for folders dragged in from the OS.
 */
export async function directoriesFromDataTransfer(dataTransfer: DataTransfer): Promise<LocalDirectoryHandle[]> {
  const items = Array.from(dataTransfer.items || [])
    .filter(item => item.kind === 'file' && typeof (item as any).getAsFileSystemHandle === 'function');
  // getAsFileSystemHandle() must be called synchronously for every item before awaiting,
  // because the data transfer is emptied once the event handler yields.
  const pending: Promise<LocalHandle | null>[] = items.map(item => (item as any).getAsFileSystemHandle());
  const handles = await Promise.all(pending);
  return handles.filter((handle): handle is LocalDirectoryHandle => handle != null && handle.kind === 'directory');
}

export function isNotFoundError(error: any): boolean {
  return error != null && (error.name === 'NotFoundError' || error.name === 'NotFoundErr');
}

export function isPermissionError(error: any): boolean {
  return error != null && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
}
