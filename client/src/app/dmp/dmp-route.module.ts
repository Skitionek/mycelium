import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DMPEditorComponent } from './components/dmp-editor.component';
import { DMPModule } from './dmp.module';

const routes: Routes = [
  {
    path: '',
    component: DMPEditorComponent,
    data: {
      title: 'Data Management Plan',
      fontAwesomeIcon: 'clipboard-list',
    },
  },
];

@NgModule({
  imports: [DMPModule, RouterModule.forChild(routes)],
})
export class DMPRouteModule {}
