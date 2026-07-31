import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EnrichmentTableViewerComponent } from './components/table/enrichment-table-viewer.component';
import { EnrichmentTablesModule } from './enrichment-tables.module';

const routes: Routes = [
  {
    path: '',
    component: EnrichmentTableViewerComponent,
    data: {
      title: 'Enrichment Table',
      fontAwesomeIcon: 'table',
    },
  },
];

@NgModule({
  imports: [
    EnrichmentTablesModule,
    RouterModule.forChild(routes),
  ],
})
export class EnrichmentTableRouteModule {
}
