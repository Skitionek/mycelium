import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatLegacyDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyRadioModule } from '@angular/material/legacy-radio';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { BiocViewComponent } from './components/bioc-view.component';
import { InfonsComponent } from './components/infons/infons.component';
import { AnnotatedTextComponent } from './components/annotated-text/annotated-text.component';
import { BiocTableViewComponent } from './components/bioc-table-view/bioc-table-view.component';

@NgModule({
  declarations: [
    BiocViewComponent,
    InfonsComponent,
    AnnotatedTextComponent,
    BiocTableViewComponent
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
  ],
  exports: [
    BiocViewComponent,
    InfonsComponent,
    AnnotatedTextComponent,
    BiocTableViewComponent
  ],
})
export class BiocViewerLibModule {
}
