import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockComponents, MockProvider } from 'ng-mocks';

import { EnrichmentVisualisationService } from 'app/enrichment/services/enrichment-visualisation.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { TableCompleteComponent } from './table/table-complete.component';
import { ChartComponent } from './chart/chart.component';
import { ClustergramComponent } from './clustergram/clustergram.component';
import { CloudViewerComponent } from './word-cloud/cloud-viewer.component';
import { GroupComponent } from './group.component';

const sampleData = [
  {
    goId: 'GO:0006915',
    goTerm: 'apoptotic process',
    'q-value': 0.001,
    gene: 'BRCA1',
    geneNames: ['BRCA1', 'TP53'],
  },
  {
    goId: 'GO:0007049',
    goTerm: 'cell cycle',
    'q-value': 0.01,
    gene: 'CCND1',
    geneNames: ['CCND1', 'CDK2'],
  },
] as any[];

const meta: Meta<GroupComponent> = {
  title: 'Enrichment/Group',
  component: GroupComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
      declarations: [
        MockComponents(TableCompleteComponent, ChartComponent, ClustergramComponent, CloudViewerComponent),
      ],
      providers: [
        MockProvider(EnrichmentVisualisationService),
        MockProvider(WorkspaceManager),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<GroupComponent>;

export const Default: Story = {
  args: {
    title: 'Biological Process',
    data: sampleData,
  },
};
