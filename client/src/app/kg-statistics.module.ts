import { NgModule } from '@angular/core';

import { NgChartsModule } from 'ng2-charts';

import { SharedModule } from 'app/shared/shared.module';

import { KgStatisticsComponent } from './kg-statistics.component';

@NgModule({
  declarations: [
    KgStatisticsComponent,
  ],
  imports: [
    SharedModule,
    NgChartsModule,
  ],
})
export class KgStatisticsModule {
}
