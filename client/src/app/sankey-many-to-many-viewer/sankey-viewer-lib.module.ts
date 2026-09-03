import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatLegacyDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyRadioModule } from '@angular/material/legacy-radio';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { SharedSankeyModule } from 'app/shared-sankey/shared-sankey.module';
import { SankeySearchPanelModule } from 'app/sankey-viewer/components/search-panel/sankey-search-panel.module';
import { SankeySearchControlModule } from 'app/sankey-viewer/components/search-control/sankey-search-control.module';

import { SankeyManyToManyModule } from './components/sankey/sankey.module';
import { SankeyManyToManyViewComponent } from './components/sankey-view.component';
import { SankeyManyToManyAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeyManyToManyDetailsPanelModule } from './components/details-panel/sankey-details-panel.module';

@NgModule({
  declarations: [
    SankeyManyToManyViewComponent,
    SankeyManyToManyAdvancedPanelComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    BrowserAnimationsModule,
    MatLegacyFormFieldModule,
    MatLegacyCheckboxModule,
    MatSidenavModule,
    MatLegacyDialogModule,
    MatLegacyChipsModule,
    MatLegacySelectModule,
    MatLegacyInputModule,
    MatLegacyButtonModule,
    MatLegacyRadioModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forRoot([]),
    SankeyManyToManyModule,
    SankeyManyToManyDetailsPanelModule,
    SharedSankeyModule,
    SankeyManyToManyDetailsPanelModule,
    SankeySearchPanelModule,
    SankeySearchControlModule
  ],
  exports: [
    SankeyManyToManyViewComponent
  ],
})
export class SankeyManyToManyViewerLibModule {
}
