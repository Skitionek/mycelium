import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';

import { FormInputFeedbackComponent } from 'app/shared/components/form/form-input-feedback.component';
import { FormRowComponent } from 'app/shared/components/form/form-row.component';
import { OrganismAutocompleteComponent } from 'app/shared/components/organism-autocomplete.component';
import { AnnotationConfigurationTableComponent } from 'app/shared/components/table/annotation-config-table.component';
import { AutoFocusDirective } from 'app/shared/directives/auto-focus.directive';
import { FormInputDirective } from 'app/shared/directives/form-input.directive';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MODAL_DECLARATIONS, modalDialogWrapper } from 'app/shared/storybook/modal-dialog';

import { EnrichmentTableEditDialogComponent } from './enrichment-table-edit-dialog.component';

const meta: Meta<EnrichmentTableEditDialogComponent> = {
  title: 'Enrichment/Table Edit Dialog',
  component: EnrichmentTableEditDialogComponent,
  decorators: [
    moduleMetadata({
      // FormsModule: the organism autocomplete binds with [(ngModel)].
      imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
      declarations: [
        ...MODAL_DECLARATIONS,
        FormRowComponent,
        FormInputFeedbackComponent,
        FormInputDirective,
        AutoFocusDirective,
        OrganismAutocompleteComponent,
        AnnotationConfigurationTableComponent,
      ],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
        MockProvider(SharedSearchService, {
          getOrganisms: () => of({ nodes: [] } as any),
          getOrganismFromTaxId: () => of({ organism_name: 'Homo sapiens', tax_id: '9606' } as any),
        }),
        MockProvider(ErrorHandler),
        MockProvider(ProgressDialog),
      ],
    }),
    modalDialogWrapper,
  ],
};

export default meta;

type Story = StoryObj<EnrichmentTableEditDialogComponent>;

export const Default: Story = {
  args: {
    title: 'Edit Enrichment Parameters',
    submitButtonLabel: 'Save',
    fileId: 'file-123',
    document: {
      taxID: '9606',
      organism: 'Homo sapiens',
      importGenes: ['BRCA1', 'MAPK1', 'TP53'],
      domains: ['GO', 'UniProt'],
    } as any,
  },
};
