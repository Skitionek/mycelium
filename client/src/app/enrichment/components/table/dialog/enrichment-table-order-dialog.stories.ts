import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { MessageDialog } from 'app/shared/services/message-dialog.service';

import { EnrichmentTableOrderDialogComponent } from './enrichment-table-order-dialog.component';

const meta: Meta<EnrichmentTableOrderDialogComponent> = {
  title: 'Enrichment/Table Order Dialog',
  component: EnrichmentTableOrderDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, NgbModule, DragDropModule],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<EnrichmentTableOrderDialogComponent>;

export const Default: Story = {
  args: {
    domains: ['Regulon', 'UniProt', 'String', 'GO', 'BioCyc', 'KEGG'],
  },
};
