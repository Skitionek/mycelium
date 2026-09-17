import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DMPListComponent } from './components/dmp-list.component';
import { DMPEditorComponent } from './components/dmp-editor.component';

@NgModule({
  declarations: [DMPListComponent, DMPEditorComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
})
export class DMPModule {}
