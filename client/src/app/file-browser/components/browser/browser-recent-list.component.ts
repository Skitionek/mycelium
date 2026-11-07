import { Component, ChangeDetectionStrategy } from '@angular/core';

import { RecentFilesService } from '../../services/recent-files.service';

@Component({
  selector: 'app-browser-recent-list',
  templateUrl: './browser-recent-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class BrowserRecentListComponent {
  constructor(
    readonly recentFilesService: RecentFilesService
  ) {}
}
