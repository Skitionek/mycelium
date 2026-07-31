import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SankeyManyToManyViewComponent } from './components/sankey-view.component';
import { SankeyManyToManyViewerLibModule } from './sankey-viewer-lib.module';

const routes: Routes = [
  {
    path: '',
    component: SankeyManyToManyViewComponent,
  },
];

@NgModule({
  imports: [
    SankeyManyToManyViewerLibModule,
    RouterModule.forChild(routes),
  ],
})
export class SankeyManyToManyViewerRouteModule {
}
