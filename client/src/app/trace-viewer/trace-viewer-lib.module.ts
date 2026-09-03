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

import { TraceViewComponent } from './components/trace-view.component';
import { TraceDetailsComponent } from './components/trace-details.component';

@NgModule({
  declarations: [
    TraceViewComponent,
    TraceDetailsComponent
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
    RouterModule.forRoot([])
  ],
})
export class TraceViewerLibModule {
}
