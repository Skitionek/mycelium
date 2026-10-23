import { UserError } from 'app/shared/exceptions';

export type LocalFolderErrorCode =
  'unsupported'
  | 'not-connected'
  | 'permission'
  | 'not-found'
  | 'read-only'
  | 'conflict'
  | 'invalid';

/**
 * An error about a local folder, worded for the user. Extends {@link UserError} so the
 * shared error handler shows the title and message as they are.
 */
export class LocalFolderError extends UserError {
  constructor(readonly code: LocalFolderErrorCode, title: string, message: string, cause: any = null) {
    super(title, message, [], null, cause, null);
  }
}

export function notConnectedError(rootName?: string): LocalFolderError {
  return new LocalFolderError(
    'not-connected',
    'Local Folder Not Connected',
    rootName
      ? `The local folder "${rootName}" needs to be reconnected. Open the File Browser and click `
      + `"Reconnect" next to it to give Mycelium access again.`
      : 'This item belongs to a local folder that is not connected in this browser. Connect the '
      + 'folder from the File Browser to open it.',
  );
}

export function permissionError(rootName: string, cause?: any): LocalFolderError {
  return new LocalFolderError(
    'permission',
    'Access to Local Folder Needed',
    `Mycelium does not currently have access to "${rootName}". Open the File Browser and click `
    + `"Reconnect" next to the folder to grant access.`,
    cause,
  );
}

export function notFoundError(path: string, cause?: any): LocalFolderError {
  return new LocalFolderError(
    'not-found',
    'Local File Not Found',
    `"${path}" no longer exists in the local folder. It may have been moved, renamed or deleted.`,
    cause,
  );
}

export function unavailableError(rootName: string, cause?: any): LocalFolderError {
  return new LocalFolderError(
    'not-found',
    'Local Folder Not Found',
    `The local folder "${rootName}" could not be found. It may have been moved, renamed or deleted. `
    + 'Connect it again from the File Browser; its existing index will be picked up.',
    cause,
  );
}

export function readOnlyError(rootName: string): LocalFolderError {
  return new LocalFolderError(
    'read-only',
    'Local Folder Is Read-only',
    `Mycelium only has read access to "${rootName}". Reconnect the folder and allow editing to make changes.`,
  );
}

export function unsupportedError(message: string): LocalFolderError {
  return new LocalFolderError('unsupported', 'Not Available for Local Files', message);
}
