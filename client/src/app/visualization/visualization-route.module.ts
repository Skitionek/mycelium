import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from 'app/auth/guards/auth-guard.service';

import { VisualizationComponent } from './containers/visualization/visualization.component';
import { VisualizationModule } from './visualization.module';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/search',
    pathMatch: 'full',
  },
  {
    path: 'graph',
    component: VisualizationComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Knowledge Graph',
      fontAwesomeIcon: 'fas fa-chart-network',
    },
  },
];

@NgModule({
  imports: [
    VisualizationModule,
    RouterModule.forChild(routes),
  ],
})
export class VisualizationRouteModule {
}
