import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { CodemirrorViewComponent } from './components/codemirror-view.component';

@NgModule({
  declarations: [
    CodemirrorViewComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    FileBrowserModule,
    RouterModule,
  ],
  exports: [
    CodemirrorViewComponent,
  ],
})
export class CodemirrorViewerLibModule {
}
