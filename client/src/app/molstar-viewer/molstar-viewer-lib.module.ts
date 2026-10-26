import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { MolstarViewComponent } from './components/molstar-view.component';

@NgModule({
  declarations: [
    MolstarViewComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    FileBrowserModule,
    RouterModule,
  ],
  exports: [
    MolstarViewComponent,
  ],
})
export class MolstarViewerLibModule {
}
