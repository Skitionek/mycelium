import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { SdrfViewComponent } from './components/sdrf-view.component';
import { SdrfPreviewComponent } from './components/sdrf-preview.component';

@NgModule({
  declarations: [
    SdrfViewComponent,
    SdrfPreviewComponent,
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
  ],
  exports: [
    SdrfPreviewComponent,
  ],
})
export class SdrfViewerLibModule {
}
