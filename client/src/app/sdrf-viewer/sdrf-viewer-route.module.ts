import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SdrfViewComponent } from './components/sdrf-view.component';
import { SdrfViewerLibModule } from './sdrf-viewer-lib.module';

const routes: Routes = [
  {
    path: '',
    component: SdrfViewComponent,
  },
];

@NgModule({
  imports: [
    SdrfViewerLibModule,
    RouterModule.forChild(routes),
  ],
})
export class SdrfViewerRouteModule {
}
