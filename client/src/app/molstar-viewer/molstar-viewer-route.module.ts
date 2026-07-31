import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MolstarViewComponent } from './components/molstar-view.component';
import { MolstarViewerLibModule } from './molstar-viewer-lib.module';

const routes: Routes = [
  {
    path: '',
    component: MolstarViewComponent,
  },
];

@NgModule({
  imports: [
    MolstarViewerLibModule,
    RouterModule.forChild(routes),
  ],
})
export class MolstarViewerRouteModule {
}
