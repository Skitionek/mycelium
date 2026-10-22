import { Component } from '@angular/core';
import { MatLegacySnackBar } from '@angular/material/legacy-snack-bar';

import { Observable } from 'rxjs';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { directoriesFromDataTransfer } from '../fs-types';
import { encodeLocalHashId } from '../local-ids';
import { LocalFolderRegistry, LocalRoot } from '../services/local-folder-registry.service';
import { LocalIndexerService, LocalRootIndexStatus } from '../services/local-indexer.service';
import { describeRootStatus } from './status-text';

/**
 * The "Local Folders" section of the file browser: connect folders from this computer,
 * see how far their indexing is, and reconnect them after a reload.
 */
@Component({
  selector: 'app-local-folder-list',
  templateUrl: './local-folder-list.component.html',
})
export class LocalFolderListComponent {
  readonly supported = this.registry.supported;
  readonly roots$: Observable<LocalRoot[]> = this.registry.roots$;
  readonly statuses$: Observable<Map<string, LocalRootIndexStatus>> = this.indexer.status$;
  dropActive = false;

  constructor(protected readonly registry: LocalFolderRegistry,
              protected readonly indexer: LocalIndexerService,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly errorHandler: ErrorHandler,
              protected readonly snackBar: MatLegacySnackBar) {
  }

  rootHashId(root: LocalRoot): string {
    return encodeLocalHashId(root.id, '');
  }

  connect() {
    this.registry.connect().then(root => this.open(root), error => this.handleError(error));
  }

  reconnect(root: LocalRoot) {
    this.registry.reconnect(root.id).then(updated => {
      if (updated.access !== 'granted') {
        this.snackBar.open(updated.access === 'unavailable'
          ? `"${root.name}" could not be found. Connect it again from its new location.`
          : `Access to "${root.name}" was not granted.`, 'Close', {duration: 5000});
      }
    }, error => this.handleError(error));
  }

  disconnect(root: LocalRoot) {
    this.registry.disconnect(root.id).then(() => {
      this.snackBar.open(
        `Disconnected "${root.name}". Its index stays in the folder and is picked up when you connect it again.`,
        'Close', {duration: 6000});
    }, error => this.handleError(error));
  }

  rescan(root: LocalRoot) {
    this.indexer.rescan(root.id);
  }

  rebuild(root: LocalRoot) {
    this.indexer.rescan(root.id, true);
  }

  toggleAnnotate(root: LocalRoot) {
    this.registry.setAnnotate(root.id, !root.annotate).catch(error => this.handleError(error));
  }

  open(root: LocalRoot) {
    this.workspaceManager.navigate(['/folders', this.rootHashId(root)]);
  }

  dragOver(event: DragEvent) {
    if (this.supported && event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'link';
      this.dropActive = true;
    }
  }

  dragLeave() {
    this.dropActive = false;
  }

  drop(event: DragEvent) {
    this.dropActive = false;
    if (!this.supported || event.dataTransfer == null) {
      return;
    }
    event.preventDefault();
    directoriesFromDataTransfer(event.dataTransfer).then(async handles => {
      if (!handles.length) {
        this.snackBar.open('Drop a folder here to connect it. Files can be uploaded into a project instead.',
          'Close', {duration: 5000});
        return;
      }
      for (const handle of handles) {
        await this.registry.connect(handle);
      }
    }).catch(error => this.handleError(error));
  }

  describe(root: LocalRoot, status: LocalRootIndexStatus | undefined): string {
    return describeRootStatus(root, status);
  }

  progress(status: LocalRootIndexStatus | undefined): number {
    if (status == null || !status.files) {
      return 0;
    }
    return Math.round(100 * (status.indexed + status.skipped + status.failed) / status.files);
  }

  trackById(index: number, root: LocalRoot) {
    return root.id;
  }

  protected handleError(error: any) {
    // The user closed the folder picker
    if (error && error.name === 'AbortError') {
      return;
    }
    this.errorHandler.showError(error);
  }
}
