import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider, MockComponents } from 'ng-mocks';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';

import { EnrichmentTableEditDialogComponent } from './enrichment-table-edit-dialog.component';

const meta: Meta<EnrichmentTableEditDialogComponent> = {
  title: 'Enrichment/Table Edit Dialog',
  component: EnrichmentTableEditDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, NgbModule],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
        MockProvider(SharedSearchService),
        MockProvider(ErrorHandler),
        MockProvider(ProgressDialog),
      ],
    }),
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
