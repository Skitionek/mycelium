import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { UnloadConfirmationGuard } from 'app/shared/guards/UnloadConfirmation.guard';

import { MapEditorComponent } from './components/map-editor/map-editor.component';
import { MapViewComponent } from './components/map-view.component';
import { DrawingToolModule } from './drawing-tool.module';

const routes: Routes = [
  {
    path: '',
    component: MapViewComponent,
    data: {
      title: 'Map',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'edit',
    component: MapEditorComponent,
    canDeactivate: [UnloadConfirmationGuard],
    data: {
      title: 'Map Editor',
      fontAwesomeIcon: 'project-diagram',
    },
  },
];

@NgModule({
  imports: [
    DrawingToolModule,
    RouterModule.forChild(routes),
  ],
})
export class MapRouteModule {
}
