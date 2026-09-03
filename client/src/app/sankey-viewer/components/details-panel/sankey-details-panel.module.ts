import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatLegacyDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyRadioModule } from '@angular/material/legacy-radio';

import { SharedModule } from 'app/shared/shared.module';

import { SankeyNodeDetailsComponent } from './node-details.component';
import { SankeyLinkDetailsComponent } from './link-details.component';
import { SankeyTraceDetailsComponent } from './trace-details.component';
import { SankeyDetailsPanelComponent } from './details-panel.component';
import { SankeyDetailsComponent } from './details.component';
import { ButtonWithSelectableTextComponent } from './button-with-selectable-text.component';

@NgModule({
  declarations: [
    SankeyDetailsPanelComponent,
    SankeyNodeDetailsComponent,
    SankeyLinkDetailsComponent,
    SankeyTraceDetailsComponent,
    SankeyDetailsComponent,
    ButtonWithSelectableTextComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    BrowserAnimationsModule,
    MatLegacyFormFieldModule,
    MatLegacyCheckboxModule,
    MatSidenavModule,
    MatLegacyDialogModule,
    MatLegacyChipsModule,
    MatLegacySelectModule,
    MatLegacyInputModule,
    MatLegacyButtonModule,
    MatLegacyRadioModule,
    SharedModule,
  ],
  exports: [
    SankeyDetailsPanelComponent,
    SankeyNodeDetailsComponent,
    SankeyTraceDetailsComponent,
    ButtonWithSelectableTextComponent
  ],
})
export class SankeyDetailsPanelModule {
}
