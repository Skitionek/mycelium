import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CodemirrorViewComponent } from './components/codemirror-view.component';
import { CodemirrorViewerLibModule } from './codemirror-viewer-lib.module';

const routes: Routes = [
  {
    path: '',
    component: CodemirrorViewComponent,
  },
];

@NgModule({
  imports: [
    CodemirrorViewerLibModule,
    RouterModule.forChild(routes),
  ],
})
export class CodemirrorViewerRouteModule {
}
