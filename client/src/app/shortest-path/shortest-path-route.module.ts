import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ShortestPathComponent } from './containers/shortest-path.component';
import { ShortestPathModule } from './shortest-path.module';

const routes: Routes = [
  {
    path: '',
    component: ShortestPathComponent,
  },
];

@NgModule({
  imports: [
    ShortestPathModule,
    RouterModule.forChild(routes),
  ],
})
export class ShortestPathRouteModule {
}
