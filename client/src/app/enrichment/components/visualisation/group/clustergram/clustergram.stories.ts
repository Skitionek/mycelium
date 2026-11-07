import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { EnrichmentVisualisationService } from 'app/enrichment/services/enrichment-visualisation.service';

import { ClustergramComponent } from './clustergram.component';

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
    geneNames: ['CCND1', 'CDK2', 'BRCA1'],
  },
] as any[];

const meta: Meta<ClustergramComponent> = {
  title: 'Enrichment/Clustergram',
  component: ClustergramComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      providers: [MockProvider(EnrichmentVisualisationService)],
    }),
  ],
};

export default meta;

type Story = StoryObj<ClustergramComponent>;

export const Default: Story = {
  args: {
    data: sampleData,
    show: true,
    showMore: false,
  },
};
