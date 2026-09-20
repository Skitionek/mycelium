import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { DMPEditorComponent } from './components/dmp-editor.component';

@NgModule({
  declarations: [DMPEditorComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule,
    FileBrowserModule,
  ],
})
export class DMPModule {}
