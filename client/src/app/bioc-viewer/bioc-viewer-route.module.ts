import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { BiocViewComponent } from './components/bioc-view.component';
import { BiocViewerLibModule } from './bioc-viewer-lib.module';

const routes: Routes = [
  {
    path: '',
    component: BiocViewComponent,
  },
];

@NgModule({
  imports: [
    BiocViewerLibModule,
    RouterModule.forChild(routes),
  ],
})
export class BiocViewerRouteModule {
}
