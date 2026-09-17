import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DMPListComponent } from './components/dmp-list.component';
import { DMPEditorComponent } from './components/dmp-editor.component';
import { DMPModule } from './dmp.module';

const routes: Routes = [
  { path: '', component: DMPListComponent },
  { path: ':hash_id', component: DMPEditorComponent },
];

@NgModule({
  imports: [DMPModule, RouterModule.forChild(routes)],
})
export class DMPRouteModule {}
