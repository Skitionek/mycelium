import { NgModule } from '@angular/core';

import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { SharedModule } from 'app/shared/shared.module';

import { KgStatisticsComponent } from './kg-statistics.component';

@NgModule({
  declarations: [
    KgStatisticsComponent,
  ],
  imports: [
    SharedModule,
    BaseChartDirective,
  ],
  providers: [provideCharts(withDefaultRegisterables())],
})
export class KgStatisticsModule {
}
