import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { LocalFolderListComponent } from './components/local-folder-list.component';
import { LocalFolderStatusComponent } from './components/local-folder-status.component';
import { LocalIndexBadgeComponent } from './components/local-index-badge.component';
import { LocalIndexIndicatorComponent } from './components/local-index-indicator.component';
import { LocalIndexerService } from './services/local-indexer.service';

const components = [
  LocalFolderListComponent,
  LocalFolderStatusComponent,
  LocalIndexBadgeComponent,
  LocalIndexIndicatorComponent,
];

/**
 * Folders connected from the user's computer through the File System Access API.
 */
@NgModule({
  declarations: components,
  imports: [SharedModule],
  exports: components,
})
export class LocalFilesystemModule {
  // Injecting the indexer here starts indexing connected folders as soon as the app loads
  constructor(indexer: LocalIndexerService) {
  }
}
