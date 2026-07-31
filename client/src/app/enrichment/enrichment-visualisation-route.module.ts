import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EnrichmentVisualisationViewerComponent } from './components/visualisation/enrichment-visualisation-viewer.component';
import { EnrichmentVisualisationsModule } from './enrichment-visualisation.module';

const routes: Routes = [
  {
    path: '',
    component: EnrichmentVisualisationViewerComponent,
    data: {
      title: 'Statistical Enrichment',
      fontAwesomeIcon: 'chart-bar',
    },
  },
];

@NgModule({
  imports: [
    EnrichmentVisualisationsModule,
    RouterModule.forChild(routes),
  ],
})
export class EnrichmentVisualisationRouteModule {
}
