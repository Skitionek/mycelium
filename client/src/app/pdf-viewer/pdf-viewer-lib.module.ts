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

import { PdfViewerLibComponent } from './pdf-viewer-lib.component';
import { AnnotationEditDialogComponent } from './components/annotation-edit-dialog.component';
import { AnnotationExcludeDialogComponent } from './components/annotation-exclude-dialog.component';
import { PdfViewerModule } from './pdf-viewer/pdf-viewer.module';
import { FileViewComponent } from './components/file-view.component';
import { AnnotationToolbarComponent } from './components/annotation-toolbar.component';

@NgModule({
  declarations: [
    PdfViewerLibComponent,
    AnnotationEditDialogComponent,
    AnnotationExcludeDialogComponent,
    FileViewComponent,
    AnnotationToolbarComponent,
  ],
  imports: [
    PdfViewerModule,
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
    PdfViewerLibComponent,
    FileViewComponent,
  ],
})
export class PdfViewerLibModule {
}
