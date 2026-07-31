import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FileViewComponent } from './components/file-view.component';
import { PdfViewerLibModule } from './pdf-viewer-lib.module';

const routes: Routes = [
  {
    path: '',
    component: FileViewComponent,
  },
];

@NgModule({
  imports: [
    PdfViewerLibModule,
    RouterModule.forChild(routes),
  ],
})
export class PdfViewerRouteModule {
}
