import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SankeyViewComponent } from './components/sankey-view.component';
import { SankeyViewerLibModule } from './sankey-viewer-lib.module';

const routes: Routes = [
  {
    path: '',
    component: SankeyViewComponent,
  },
];

@NgModule({
  imports: [
    SankeyViewerLibModule,
    RouterModule.forChild(routes),
  ],
})
export class SankeyViewerRouteModule {
}
