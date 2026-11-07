import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { EnrichmentTablePreviewComponent } from './enrichment-table-preview.component';

const meta: Meta<EnrichmentTablePreviewComponent> = {
  title: 'Enrichment/Table Preview',
  component: EnrichmentTablePreviewComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<EnrichmentTablePreviewComponent>;

export const Default: Story = {
  args: {
    document: {
      organism: 'Homo sapiens',
      importGenes: ['BRCA1', 'MAPK1', 'TP53', 'EGFR'],
      domains: ['Regulon', 'UniProt', 'GO'],
    } as any,
  },
};

export const Empty: Story = {
  args: {
    document: {
      organism: '',
      importGenes: [],
      domains: [],
    } as any,
  },
};
