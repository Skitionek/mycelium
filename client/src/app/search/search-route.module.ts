import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ContentSearchComponent } from './components/content-search.component';
import { GraphSearchComponent } from './components/graph-search.component';
import { SearchModule } from './search.module';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'graph',
    pathMatch: 'full',
  },
  {
    path: 'graph',
    component: GraphSearchComponent,
    data: {
      title: 'Knowledge Graph',
      fontAwesomeIcon: 'fas fa-chart-network',
    },
  },
  {
    path: 'content',
    component: ContentSearchComponent,
    data: {
      title: 'Search',
      fontAwesomeIcon: 'search',
    },
  },
];

@NgModule({
  imports: [
    SearchModule,
    RouterModule.forChild(routes),
  ],
})
export class SearchRouteModule {
}
