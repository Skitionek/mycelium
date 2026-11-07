import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { RouterTestingModule } from '@angular/router/testing';

import { WorkspaceManager } from 'app/shared/workspace-manager';

import { CloudViewerComponent } from './cloud-viewer.component';

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
    geneNames: ['CCND1'],
  },
] as any[];

const meta: Meta<CloudViewerComponent> = {
  title: 'Enrichment/Cloud Viewer',
  component: CloudViewerComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule],
      providers: [MockProvider(WorkspaceManager)],
    }),
  ],
};

export default meta;

type Story = StoryObj<CloudViewerComponent>;

export const Default: Story = {
  args: {
    data: sampleData,
    show: true,
    showMore: false,
  },
};
