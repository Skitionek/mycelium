import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpEvent, HttpResponse } from '@angular/common/http';

import { defer, firstValueFrom, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import JSZip from 'jszip';

import { FilesystemObject, ProjectImpl } from 'app/file-browser/models/filesystem-object';
import { BulkObjectUpdateRequest, ObjectCreateRequest } from 'app/file-browser/schema';
import { ApiService } from 'app/shared/services/api.service';
import { LIBREOFFICE_CONVERTIBLE_MIME_TYPES, MimeTypes } from 'app/shared/constants';

import {
  isNotFoundError,
  isPermissionError,
  LocalDirectoryHandle,
  LocalFileHandle,
  LocalHandle,
} from '../fs-types';
import {
  baseName,
  decodeLocalHashId,
  encodeLocalHashId,
  isLocalHashId,
  joinPath,
  LocalObjectRef,
  parentPath,
  splitPath,
} from '../local-ids';
import { detectMimeType, getExtension, isPdfConvertible, withTypeExtension } from '../mime';
import {
  LocalFolderError,
  notFoundError,
  permissionError,
  unsupportedError,
} from '../local-folder-errors';
import { LocalFolderRegistry, LocalRoot } from './local-folder-registry.service';

export interface LocalFileListing {
  name: string;
  size: number;
  lastModified: number;
  handle: LocalFileHandle;
}

/**
 * Things that happened to local files through Mycelium, so the indexer can react
 * without rescanning.
 */
export type LocalFilesystemEvent =
  { type: 'listed', rootId: string, path: string, handle: LocalDirectoryHandle, files: LocalFileListing[] }
  | { type: 'opened', rootId: string, path: string }
  | { type: 'changed', rootId: string, path: string }
  | { type: 'removed', rootId: string, path: string };

export interface ResolvedLocalObject {
  root: LocalRoot;
  ref: LocalObjectRef;
  handle: LocalHandle;
  /** The directory containing the object; null for the connected folder itself. */
  parent: LocalDirectoryHandle | null;
}

const LISTING_CONCURRENCY = 32;
const IGNORED_NAMES = new Set(['thumbs.db', 'desktop.ini']);

/**
 * Names that are not shown or indexed: dotfiles (including the index itself), except the
 * folder-level `.annotations` config that Mycelium understands, and OS clutter.
 */
export function isHiddenName(name: string): boolean {
  return (name.startsWith('.') && name !== '.annotations') || IGNORED_NAMES.has(name.toLowerCase());
}

/**
 * Exposes files in connected local folders as {@link FilesystemObject}s, which is what lets
 * the file browser and every viewer open them exactly like files stored in a project.
 * {@link FilesystemService} hands requests for local hash IDs over to this service.
 */
@Injectable({providedIn: 'root'})
export class LocalFilesystemService {
  private readonly eventsSubject = new Subject<LocalFilesystemEvent>();
  readonly events$: Observable<LocalFilesystemEvent> = this.eventsSubject.asObservable();
  private readonly mimeTypeCache = new Map<string, string>();

  constructor(protected readonly registry: LocalFolderRegistry,
              protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly ngZone: NgZone) {
  }

  isLocal(hashId: string): boolean {
    return isLocalHashId(hashId);
  }

  // ========================================
  // Reading
  // ========================================

  get(hashId: string): Observable<FilesystemObject> {
    return defer(() => this.getObject(hashId));
  }

  getContent(hashId: string): Observable<Blob> {
    return defer(async () => {
      const {handle, ref} = await this.resolve(hashId);
      return this.readFile(handle, ref);
    });
  }

  /**
   * The file as a PDF. Office documents are converted by the server, without being stored.
   */
  getContentAsPdf(hashId: string): Observable<Blob> {
    return defer(async () => {
      const {root, handle, ref} = await this.resolve(hashId);
      const file = await this.readFile(handle, ref);
      const mimeType = await this.mimeTypeOf(root.id, ref.path, file);
      if (mimeType === MimeTypes.Pdf) {
        return file as Blob;
      }
      if (!LIBREOFFICE_CONVERTIBLE_MIME_TYPES.has(mimeType) && !isPdfConvertible(file.name, mimeType)) {
        throw unsupportedError(`"${file.name}" cannot be shown as a PDF.`);
      }
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('mimeType', mimeType);
      return firstValueFrom(this.http.post('/api/filesystem/convert/pdf', form, {
        ...this.apiService.getHttpOptions(true),
        responseType: 'blob',
      }));
    });
  }

  /**
   * The `graph.json` of a map file, mirroring the appserver's map-content endpoint.
   */
  getMapContent(hashId: string): Observable<Blob> {
    return defer(async () => {
      const {handle, ref} = await this.resolve(hashId);
      const file = await this.readFile(handle, ref);
      const zip = await JSZip.loadAsync(file);
      const graph = zip.file('graph.json');
      if (graph == null) {
        throw new LocalFolderError('invalid', 'Invalid Map', `"${file.name}" is not a valid map file.`);
      }
      return graph.async('blob');
    });
  }

  /**
   * Make an object from what is already known about a file, without touching the disk.
   */
  describe(root: LocalRoot, path: string, file?: { mimeType: string, size?: number, lastModified?: number }): FilesystemObject {
    const project = this.makeProject(root);
    const parent = path ? this.makeAncestors(root, project, parentPath(path)) : null;
    if (file == null) {
      return this.makeObject(root, project, path, parent, null);
    }
    return this.makeObject(root, project, path, parent, {
      mimeType: file.mimeType,
      size: file.size,
      lastModified: file.lastModified,
    });
  }

  /**
   * The MIME type of a file, sniffing its content when the name is ambiguous. Results
   * are cached per file version so listings stay cheap.
   */
  async mimeTypeOf(rootId: string, path: string, file: File): Promise<string> {
    const key = `${rootId}/${path}|${file.size}|${file.lastModified}`;
    let mimeType = this.mimeTypeCache.get(key);
    if (mimeType == null) {
      mimeType = await detectMimeType(file.name, file);
      if (this.mimeTypeCache.size > 10000) {
        this.mimeTypeCache.clear();
      }
      this.mimeTypeCache.set(key, mimeType);
    }
    return mimeType;
  }

  /**
   * Find the handle for a hash ID, asking for access to its folder if needed.
   */
  async resolve(hashId: string, write = false): Promise<ResolvedLocalObject> {
    const ref = decodeLocalHashId(hashId);
    if (ref == null) {
      throw notFoundError(hashId);
    }
    const root = await this.registry.ensureAccess(ref.rootId, write);
    const segments = splitPath(ref.path);
    if (!segments.length) {
      return {root, ref, handle: root.handle, parent: null};
    }
    try {
      let parent = root.handle;
      for (const segment of segments.slice(0, -1)) {
        parent = await parent.getDirectoryHandle(segment);
      }
      const name = segments[segments.length - 1];
      let handle: LocalHandle;
      try {
        handle = await parent.getFileHandle(name);
      } catch (e) {
        if (e && e.name === 'TypeMismatchError') {
          handle = await parent.getDirectoryHandle(name);
        } else {
          throw e;
        }
      }
      return {root, ref, handle, parent};
    } catch (e) {
      throw this.translateError(root, ref.path, e);
    }
  }

  // ========================================
  // Writing
  // ========================================

  /**
   * Apply changes to local objects. Content, name and location can change; details that
   * only exist on the server (description, sharing, annotation settings) are ignored.
   */
  save(hashIds: string[], changes: Partial<BulkObjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: FilesystemObject }): Observable<{ [hashId: string]: FilesystemObject }> {
    return defer(async () => {
      const result: { [hashId: string]: FilesystemObject } = updateWithLatest || {};
      for (const hashId of hashIds) {
        result[hashId] = await this.saveOne(hashId, changes);
      }
      return result;
    });
  }

  delete(hashIds: string[],
         updateWithLatest?: { [hashId: string]: FilesystemObject }): Observable<{ [hashId: string]: FilesystemObject }> {
    return defer(async () => {
      const result: { [hashId: string]: FilesystemObject } = updateWithLatest || {};
      for (const hashId of hashIds) {
        const resolved = await this.resolve(hashId, true);
        if (resolved.parent == null) {
          throw unsupportedError('A connected folder cannot be deleted from Mycelium. Disconnect it instead.');
        }
        const object = await this.getObject(hashId, false);
        try {
          await resolved.parent.removeEntry(resolved.handle.name, {recursive: true});
        } catch (e) {
          throw this.translateError(resolved.root, resolved.ref.path, e);
        }
        this.emit({type: 'removed', rootId: resolved.root.id, path: resolved.ref.path});
        this.notifyObjectUpdate(resolved.root.id, parentPath(resolved.ref.path));
        result[hashId] = object;
      }
      return result;
    });
  }

  /**
   * Create a file or folder in a local folder. Returns the same kind of event stream as an
   * upload to the server so the creation dialogs work unchanged.
   */
  create(request: ObjectCreateRequest): Observable<HttpEvent<any> & { bodyValue?: FilesystemObject }> {
    return defer(() => this.createObject(request)).pipe(
      map(object => {
        const event: HttpResponse<any> & { bodyValue?: FilesystemObject } = new HttpResponse({
          status: 200,
          body: {result: {hashId: object.hashId}},
        });
        event.bodyValue = object;
        return event;
      }),
    );
  }

  // ========================================
  // Internals
  // ========================================

  protected async getObject(hashId: string, withChildren = true): Promise<FilesystemObject> {
    const {root, ref, handle} = await this.resolve(hashId);
    const project = this.makeProject(root);
    const parent = ref.path ? this.makeAncestors(root, project, parentPath(ref.path)) : null;
    if (handle.kind === 'directory') {
      const object = this.makeObject(root, project, ref.path, parent, null);
      if (withChildren) {
        object.children.replace(await this.listChildren(root, project, object, handle, ref.path));
      }
      return object;
    }
    const file = await this.readFile(handle, ref);
    const mimeType = await this.mimeTypeOf(root.id, ref.path, file);
    if (withChildren) {
      this.emit({type: 'opened', rootId: root.id, path: ref.path});
    }
    return this.makeObject(root, project, ref.path, parent, {
      mimeType,
      size: file.size,
      lastModified: file.lastModified,
    });
  }

  protected async listChildren(root: LocalRoot, project: ProjectImpl, directory: FilesystemObject,
                               handle: LocalDirectoryHandle, path: string): Promise<FilesystemObject[]> {
    const entries: LocalHandle[] = [];
    try {
      for await (const entry of handle.values()) {
        if (!isHiddenName(entry.name)) {
          entries.push(entry);
        }
      }
    } catch (e) {
      throw this.translateError(root, path, e);
    }

    const children: FilesystemObject[] = [];
    const files: LocalFileListing[] = [];
    for (let i = 0; i < entries.length; i += LISTING_CONCURRENCY) {
      const batch = await Promise.all(entries.slice(i, i + LISTING_CONCURRENCY).map(async entry => {
        const childPath = joinPath(path, entry.name);
        if (entry.kind === 'directory') {
          return this.makeObject(root, project, childPath, directory, null);
        }
        try {
          const file = await entry.getFile();
          files.push({name: entry.name, size: file.size, lastModified: file.lastModified, handle: entry});
          return this.makeObject(root, project, childPath, directory, {
            mimeType: await this.mimeTypeOf(root.id, childPath, file),
            size: file.size,
            lastModified: file.lastModified,
          });
        } catch (e) {
          // Removed while listing, or unreadable (e.g. locked by another program)
          return null;
        }
      }));
      children.push(...batch.filter(child => child != null));
    }
    this.emit({type: 'listed', rootId: root.id, path, handle, files});
    return children;
  }

  protected async saveOne(hashId: string, changes: Partial<BulkObjectUpdateRequest>): Promise<FilesystemObject> {
    let resolved = await this.resolve(hashId, true);
    const {root} = resolved;
    let path = resolved.ref.path;

    if (changes.contentValue != null) {
      if (resolved.handle.kind !== 'file') {
        throw unsupportedError('Folders have no content to save.');
      }
      await this.writeFile(root, path, resolved.handle, changes.contentValue);
    }

    const newName = changes.filename != null && changes.filename !== resolved.handle.name ? changes.filename : null;
    let destination: ResolvedLocalObject | null = null;
    if (changes.parentHashId != null && changes.parentHashId !== encodeLocalHashId(root.id, parentPath(path))) {
      if (!isLocalHashId(changes.parentHashId)) {
        throw unsupportedError('Items cannot be moved between a local folder and a project.');
      }
      destination = await this.resolve(changes.parentHashId, true);
      if (destination.handle.kind !== 'directory') {
        throw unsupportedError('Items can only be moved into folders.');
      }
      if (destination.root.id === root.id
        && (destination.ref.path === path || destination.ref.path.startsWith(path + '/'))) {
        throw unsupportedError('A folder cannot be moved into itself.');
      }
    }

    if (newName != null || destination != null) {
      if (resolved.parent == null) {
        throw unsupportedError('A connected folder cannot be renamed or moved from Mycelium.');
      }
      validateName(newName || resolved.handle.name);
      const targetDir = destination ? destination.handle as LocalDirectoryHandle : resolved.parent;
      const targetName = newName || resolved.handle.name;
      if (await entryExists(targetDir, targetName)) {
        throw new LocalFolderError('conflict', 'Name Already Taken', `There is already an item named "${targetName}" there.`);
      }
      await this.moveEntry(resolved, targetDir, targetName);
      const targetRoot = destination ? destination.root : root;
      const targetPath = joinPath(destination ? destination.ref.path : parentPath(path), targetName);
      this.emit({type: 'removed', rootId: root.id, path});
      this.notifyObjectUpdate(root.id, parentPath(path));
      this.emit({type: 'changed', rootId: targetRoot.id, path: targetPath});
      this.notifyObjectUpdate(targetRoot.id, parentPath(targetPath));
      resolved = await this.resolve(encodeLocalHashId(targetRoot.id, targetPath));
      path = targetPath;
    }

    return this.getObject(encodeLocalHashId(resolved.root.id, path), false);
  }

  protected async createObject(request: ObjectCreateRequest): Promise<FilesystemObject> {
    const parent = await this.resolve(request.parentHashId, true);
    if (parent.handle.kind !== 'directory') {
      throw unsupportedError('Items can only be created inside folders.');
    }
    const directory = parent.handle;
    validateName(request.filename);

    if (request.mimeType === MimeTypes.Directory) {
      const directoryPath = joinPath(parent.ref.path, request.filename);
      try {
        await directory.getDirectoryHandle(request.filename, {create: true});
      } catch (e) {
        throw this.translateError(parent.root, directoryPath, e);
      }
      this.notifyObjectUpdate(parent.root.id, parent.ref.path);
      return this.getObject(encodeLocalHashId(parent.root.id, directoryPath), false);
    }

    let content: Blob;
    if (request.contentValue != null) {
      content = request.contentValue;
    } else if (request.contentHashId != null && isLocalHashId(request.contentHashId)) {
      const source = await this.resolve(request.contentHashId);
      content = await this.readFile(source.handle, source.ref);
    } else {
      throw unsupportedError('Files in a local folder can only be created from content on this computer.');
    }

    const filename = await uniqueName(directory, withTypeExtension(request.filename, request.mimeType));
    const path = joinPath(parent.ref.path, filename);
    try {
      const handle = await directory.getFileHandle(filename, {create: true});
      await this.writeFile(parent.root, path, handle, content);
    } catch (e) {
      throw e instanceof LocalFolderError ? e : this.translateError(parent.root, path, e);
    }
    this.notifyObjectUpdate(parent.root.id, parent.ref.path);
    return this.getObject(encodeLocalHashId(parent.root.id, path), false);
  }

  protected async writeFile(root: LocalRoot, path: string, handle: LocalFileHandle, content: Blob) {
    try {
      const writable = await handle.createWritable();
      try {
        await writable.write(content);
        await writable.close();
      } catch (e) {
        if (writable.abort) {
          await writable.abort().catch(() => undefined);
        }
        throw e;
      }
    } catch (e) {
      throw this.translateError(root, path, e);
    }
    this.emit({type: 'changed', rootId: root.id, path});
  }

  protected async moveEntry(resolved: ResolvedLocalObject, targetDir: LocalDirectoryHandle, targetName: string) {
    const {handle, parent, root, ref} = resolved;
    try {
      if (typeof handle.move === 'function') {
        if (await targetDir.isSameEntry(parent)) {
          await handle.move(targetName);
        } else {
          await handle.move(targetDir, targetName);
        }
        return;
      }
      if (handle.kind !== 'file') {
        throw unsupportedError('This browser cannot rename or move folders. Use your file manager instead.');
      }
      // Fallback for browsers without move(): copy, then remove the original
      const file = await handle.getFile();
      const copy = await targetDir.getFileHandle(targetName, {create: true});
      const writable = await copy.createWritable();
      await writable.write(file);
      await writable.close();
      await parent.removeEntry(handle.name);
    } catch (e) {
      throw e instanceof LocalFolderError ? e : this.translateError(root, ref.path, e);
    }
  }

  protected async readFile(handle: LocalHandle, ref: LocalObjectRef): Promise<File> {
    if (handle.kind !== 'file') {
      throw unsupportedError('Folders have no content to open.');
    }
    try {
      return await handle.getFile();
    } catch (e) {
      const root = this.registry.getRoot(ref.rootId);
      throw root ? this.translateError(root, ref.path, e) : e;
    }
  }

  protected translateError(root: LocalRoot, path: string, error: any): any {
    if (error instanceof LocalFolderError) {
      return error;
    }
    if (isNotFoundError(error)) {
      // The folder itself may be gone; check so it shows up as such in the browser
      root.handle.values().next().catch(rootError => this.registry.markLost(root.id, rootError));
      return notFoundError(path ? `${root.name}/${path}` : root.name, error);
    }
    if (isPermissionError(error)) {
      this.registry.markLost(root.id, error);
      return permissionError(root.name, error);
    }
    if (error && error.name === 'NoModificationAllowedError') {
      return new LocalFolderError('conflict', 'File In Use',
        `"${baseName(path) || root.name}" could not be changed, possibly because another program is using it.`, error);
    }
    return error;
  }

  protected makeProject(root: LocalRoot): ProjectImpl {
    return new ProjectImpl().update({
      hashId: encodeLocalHashId(root.id, ''),
      name: root.name,
      description: 'Local folder',
      creationDate: root.addedAt,
      modifiedDate: root.addedAt,
      privileges: {
        readable: true,
        writable: root.writable,
        administrable: false,
      },
    });
  }

  protected makeAncestors(root: LocalRoot, project: ProjectImpl, path: string): FilesystemObject {
    let current = this.makeObject(root, project, '', null, null);
    let prefix = '';
    for (const segment of splitPath(path)) {
      prefix = joinPath(prefix, segment);
      current = this.makeObject(root, project, prefix, current, null);
    }
    return current;
  }

  /**
   * @param file null for a directory
   */
  protected makeObject(root: LocalRoot, project: ProjectImpl, path: string, parent: FilesystemObject | null,
                       file: { mimeType: string, size?: number, lastModified?: number } | null): FilesystemObject {
    const object = new FilesystemObject();
    object.hashId = encodeLocalHashId(root.id, path);
    object.filename = path ? baseName(path) : root.name;
    object.trueFilename = object.filename;
    object.filePath = '/' + (path ? `${root.name}/${path}` : root.name);
    object.mimeType = file ? file.mimeType : MimeTypes.Directory;
    object.description = null;
    object.public = false;
    object.user = null;
    object.project = project;
    object.parent = parent;
    object.recycled = false;
    object.effectivelyRecycled = false;
    object.privileges = {
      readable: true,
      writable: root.writable,
      commentable: false,
    };
    if (file != null && file.lastModified != null) {
      object.modifiedDate = new Date(file.lastModified).toISOString();
    }
    object.local = {
      rootId: root.id,
      path,
      size: file ? file.size : undefined,
      lastModified: file ? file.lastModified : undefined,
    };
    return object;
  }

  protected emit(event: LocalFilesystemEvent) {
    this.ngZone.run(() => this.eventsSubject.next(event));
  }

  /**
   * Let open views of a folder know its contents changed (see FilesystemObjectTargetDirective).
   */
  notifyObjectUpdate(rootId: string, path: string) {
    if (typeof document !== 'undefined') {
      document.body.dispatchEvent(new CustomEvent('myceliumobjectupdate', {
        detail: {hashId: encodeLocalHashId(rootId, path)},
      }));
    }
  }
}

function validateName(name: string) {
  if (!name || name === '.' || name === '..' || /[\/\\]/.test(name)) {
    throw new LocalFolderError('invalid', 'Invalid Name', `"${name || ''}" is not a valid file name.`);
  }
}

async function entryExists(directory: LocalDirectoryHandle, name: string): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (e) {
    if (e && e.name === 'TypeMismatchError') {
      return true;
    }
    if (isNotFoundError(e)) {
      return false;
    }
    throw e;
  }
}

/**
 * The name, or "name (2).ext" and so on if it is taken, like file managers do.
 */
async function uniqueName(directory: LocalDirectoryHandle, name: string): Promise<string> {
  if (!(await entryExists(directory, name))) {
    return name;
  }
  const extension = getExtension(name);
  const stem = extension ? name.slice(0, -extension.length) : name;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem} (${i})${extension}`;
    if (!(await entryExists(directory, candidate))) {
      return candidate;
    }
  }
  throw new LocalFolderError('conflict', 'Name Already Taken', `There is already an item named "${name}" there.`);
}
