import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ChartComponent } from './chart.component';

const sampleData = [
  {
    goId: 'GO:0006915',
    goTerm: 'apoptotic process',
    'q-value': 0.001,
    gene: 'BRCA1',
    geneNames: ['BRCA1', 'TP53', 'BAX'],
  },
  {
    goId: 'GO:0007049',
    goTerm: 'cell cycle',
    'q-value': 0.01,
    gene: 'CCND1',
    geneNames: ['CCND1', 'CDK2'],
  },
  {
    goId: 'GO:0016310',
    goTerm: 'phosphorylation',
    'q-value': 0.05,
    gene: 'MAPK1',
    geneNames: ['MAPK1'],
  },
] as any[];

const meta: Meta<ChartComponent> = {
  title: 'Enrichment/Chart',
  component: ChartComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<ChartComponent>;

export const Default: Story = {
  args: { data: sampleData },
};
