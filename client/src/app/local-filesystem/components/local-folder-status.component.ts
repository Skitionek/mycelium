import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';

import { combineLatest, Observable, of, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { LocalFolderRegistry, LocalRoot } from '../services/local-folder-registry.service';
import { LocalFilesystemService } from '../services/local-filesystem.service';
import { LocalIndexerService, LocalRootIndexStatus, LocalSearchHit } from '../services/local-indexer.service';
import { describeRootStatus } from './status-text';

interface StatusView {
  root: LocalRoot;
  status: LocalRootIndexStatus | undefined;
  text: string;
  progress: number;
}

/**
 * Shown above the contents of a local folder: indexing progress, folder actions and a
 * search over everything indexed in it.
 */
@Component({
  selector: 'app-local-folder-status',
  templateUrl: './local-folder-status.component.html',
})
export class LocalFolderStatusComponent implements OnChanges, OnDestroy {
  @Input() object: FilesystemObject;
  /** Search results to show instead of the folder's contents, or null when not searching. */
  @Output() searchResults = new EventEmitter<CollectionModel<FilesystemObject> | null>();

  view$: Observable<StatusView | null> = of(null);
  query = '';
  resultCount: number | null = null;
  private readonly queries = new Subject<string>();
  private readonly subscriptions = new Subscription();

  constructor(protected readonly registry: LocalFolderRegistry,
              protected readonly indexer: LocalIndexerService,
              protected readonly localFilesystem: LocalFilesystemService,
              protected readonly errorHandler: ErrorHandler) {
    this.subscriptions.add(this.queries.pipe(
      debounceTime(200),
      distinctUntilChanged(),
    ).subscribe(query => this.runSearch(query)));
    // Results follow the index as it grows
    this.subscriptions.add(this.indexer.status$.pipe(debounceTime(1000)).subscribe(() => {
      if (this.query.trim()) {
        this.runSearch(this.query);
      }
    }));
  }

  ngOnChanges() {
    const rootId = this.object && this.object.local ? this.object.local.rootId : null;
    if (rootId == null) {
      this.view$ = of(null);
      return;
    }
    this.view$ = combineLatest([
      this.registry.roots$.pipe(map(roots => roots.find(root => root.id === rootId))),
      this.indexer.rootStatus$(rootId),
    ]).pipe(map(([root, status]) => root == null ? null : {
      root,
      status,
      text: describeRootStatus(root, status),
      progress: status && status.files
        ? Math.round(100 * (status.indexed + status.skipped + status.failed) / status.files)
        : 0,
    }));
    if (this.query) {
      this.runSearch(this.query);
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  search(query: string) {
    this.query = query;
    this.queries.next(query);
  }

  clearSearch() {
    this.query = '';
    this.queries.next('');
  }

  rescan(root: LocalRoot) {
    this.indexer.rescan(root.id);
  }

  rebuild(root: LocalRoot) {
    this.indexer.rescan(root.id, true);
  }

  reconnect(root: LocalRoot) {
    this.registry.reconnect(root.id).catch(error => this.errorHandler.showError(error));
  }

  toggleAnnotate(root: LocalRoot) {
    this.registry.setAnnotate(root.id, !root.annotate).catch(error => this.errorHandler.showError(error));
  }

  protected runSearch(query: string) {
    const local = this.object && this.object.local;
    const root = local ? this.registry.getRoot(local.rootId) : undefined;
    if (!query.trim() || root == null) {
      this.resultCount = null;
      this.searchResults.emit(null);
      return;
    }
    const prefix = local.path ? local.path + '/' : '';
    const hits = this.indexer.search(query, [root.id]).filter(hit => hit.path.startsWith(prefix));
    this.resultCount = hits.length;
    this.searchResults.emit(new CollectionModel(hits.map(hit => this.toObject(root, hit)), {
      multipleSelection: true,
    }));
  }

  protected toObject(root: LocalRoot, hit: LocalSearchHit): FilesystemObject {
    const object = this.localFilesystem.describe(root, hit.path, {
      mimeType: hit.mimeType,
      size: hit.size,
      lastModified: hit.lastModified,
    });
    const counts = Object.entries(hit.matches)
      .filter(([, count]) => count > 0)
      .map(([term, count]) => `"${term}" ×${count}`);
    object.description = [
      hit.path,
      counts.length ? `Matches: ${counts.join(', ')}` : 'Matches the file name',
      hit.excerpt || '',
    ].filter(line => line).join('\n\n');
    return object;
  }
}
