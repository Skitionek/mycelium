import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { LocalIndexerService } from '../services/local-indexer.service';
import { describeFileStatus } from './status-text';

/**
 * Shows how far a local file has been indexed, updating live.
 */
@Component({
  selector: 'app-local-index-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="view$ | async as view">
      <span class="text-nowrap" [ngbTooltip]="view.detail" [disableTooltip]="!view.detail" container="body"
            [attr.data-local-index-state]="view.label">
        <i class="fa-fw {{ view.icon }}"></i>
        <span class="ms-1" *ngIf="showLabel">{{ view.label }}</span>
        <span class="ms-1 text-muted" *ngIf="detailed && view.detail">({{ view.detail }})</span>
      </span>
    </ng-container>
  `,
})
export class LocalIndexBadgeComponent implements OnChanges {
  @Input() object: FilesystemObject | undefined;
  @Input() showLabel = true;
  @Input() detailed = false;
  view$: Observable<{ icon: string, label: string, detail: string } | null> = of(null);

  constructor(protected readonly indexer: LocalIndexerService) {
  }

  ngOnChanges() {
    const object = this.object;
    this.view$ = object != null && object.isLocal && object.isFile
      ? this.indexer.fileStatus$(object.hashId).pipe(map(status => describeFileStatus(status)))
      : of(null);
  }
}
