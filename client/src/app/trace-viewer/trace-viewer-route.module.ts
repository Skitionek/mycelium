import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TraceViewComponent } from './components/trace-view.component';
import { TraceViewerLibModule } from './trace-viewer-lib.module';

const routes: Routes = [
  {
    path: '',
    component: TraceViewComponent,
  },
];

@NgModule({
  imports: [
    TraceViewerLibModule,
    RouterModule.forChild(routes),
  ],
})
export class TraceViewerRouteModule {
}
