/**
 * Local files and folders get hash IDs of their own so that every part of the app that
 * addresses objects by hash ID (routes, tabs, recent files, map links) works for them unchanged.
 *
 * The format is `fs~<rootId>~<path>`, where the path is relative to the connected folder and
 * base64url-encoded so the ID is a single URL segment. Server hash IDs never contain `~`.
 */
export const LOCAL_HASH_ID_PREFIX = 'fs~';

const ROOT_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export interface LocalObjectRef {
  rootId: string;
  /** Path relative to the connected folder, segments joined with `/`; empty for the folder itself. */
  path: string;
}

/**
 * What a {@link FilesystemObject} of a local file or folder knows about where it lives.
 */
export interface LocalObjectInfo extends LocalObjectRef {
  size?: number;
  lastModified?: number;
}

export function isLocalHashId(hashId: string | null | undefined): boolean {
  return typeof hashId === 'string' && hashId.startsWith(LOCAL_HASH_ID_PREFIX);
}

export function encodeLocalHashId(rootId: string, path: string): string {
  return `${LOCAL_HASH_ID_PREFIX}${rootId}~${encodeBase64Url(normalizePath(path))}`;
}

export function decodeLocalHashId(hashId: string): LocalObjectRef | null {
  if (!isLocalHashId(hashId)) {
    return null;
  }
  const rest = hashId.slice(LOCAL_HASH_ID_PREFIX.length);
  const separator = rest.indexOf('~');
  if (separator <= 0) {
    return null;
  }
  try {
    return {
      rootId: rest.slice(0, separator),
      path: normalizePath(decodeBase64Url(rest.slice(separator + 1))),
    };
  } catch (e) {
    return null;
  }
}

export function generateRootId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => ROOT_ID_ALPHABET[byte % ROOT_ID_ALPHABET.length]).join('');
}

export function isValidRootId(value: any): value is string {
  return typeof value === 'string' && /^[a-z0-9]{8,64}$/.test(value);
}

export function splitPath(path: string): string[] {
  return path.split('/').filter(segment => segment.length && segment !== '.');
}

export function normalizePath(path: string): string {
  const segments = splitPath(path || '');
  if (segments.includes('..')) {
    throw new Error(`Invalid local path: ${path}`);
  }
  return segments.join('/');
}

export function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function parentPath(path: string): string {
  const segments = splitPath(path);
  segments.pop();
  return segments.join('/');
}

export function baseName(path: string): string {
  const segments = splitPath(path);
  return segments.length ? segments[segments.length - 1] : '';
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
}
