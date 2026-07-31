import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { KgStatisticsComponent } from './kg-statistics.component';
import { KgStatisticsModule } from './kg-statistics.module';

const routes: Routes = [
  {
    path: '',
    component: KgStatisticsComponent,
    data: {
      fontAwesomeIcon: 'fas fa-chart-bar',
    },
  },
];

@NgModule({
  imports: [
    KgStatisticsModule,
    RouterModule.forChild(routes),
  ],
})
export class KgStatisticsRouteModule {
}
