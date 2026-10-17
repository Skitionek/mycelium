import { ChangeDetectionStrategy, Component } from '@angular/core';

import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { LocalFolderRegistry } from '../services/local-folder-registry.service';
import { LocalIndexerService } from '../services/local-indexer.service';

interface IndicatorView {
  visible: boolean;
  active: boolean;
  attention: boolean;
  tooltip: string;
}

/**
 * Navigation bar indicator for local folders: spins while indexing and asks for attention
 * when a folder needs reconnecting.
 */
@Component({
  selector: 'app-local-index-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="view$ | async as view">
      <a *ngIf="view.visible" appLink="/projects" [forceWorkbench]="true" [newTab]="true" preferPane="left"
         placement="right" [ngbTooltip]="view.tooltip" class="position-relative" data-local-index-indicator>
        <i class="fa fa-hdd" *ngIf="!view.active"></i>
        <i class="fa fa-sync fa-spin" *ngIf="view.active"></i>
        <span *ngIf="view.attention" class="position-absolute top-0 start-100 translate-middle p-1 bg-warning rounded-circle"
              style="margin-left: -10px; margin-top: 10px">
          <span class="visually-hidden">Needs attention</span>
        </span>
      </a>
    </ng-container>
  `,
})
export class LocalIndexIndicatorComponent {
  readonly view$: Observable<IndicatorView> = combineLatest([this.registry.roots$, this.indexer.summary$]).pipe(
    map(([roots, summary]) => {
      const waiting = roots.filter(root => root.access !== 'granted').length;
      const lines: string[] = [];
      if (summary.active) {
        lines.push(`Indexing local folders: ${summary.done} of ${summary.files} files`);
        if (summary.annotationsQueued) {
          lines.push(`${summary.annotationsQueued} documents waiting to be annotated`);
        }
      } else {
        lines.push(`Local folders up to date (${summary.files} files)`);
      }
      if (waiting) {
        lines.push(`${waiting} folder${waiting === 1 ? '' : 's'} need${waiting === 1 ? 's' : ''} reconnecting`);
      }
      return {
        visible: roots.length > 0,
        active: summary.active,
        attention: waiting > 0,
        tooltip: lines.join('. '),
      };
    }),
  );

  constructor(protected readonly registry: LocalFolderRegistry,
              protected readonly indexer: LocalIndexerService) {
  }
}
