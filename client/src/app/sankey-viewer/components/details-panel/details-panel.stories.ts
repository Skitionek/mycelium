import { CommonModule } from '@angular/common';

import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockComponents, MockProvider } from 'ng-mocks';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { SankeyNodeDetailsComponent } from './node-details.component';
import { SankeyLinkDetailsComponent } from './link-details.component';
import { SankeyTraceDetailsComponent } from './trace-details.component';
import { SankeyDetailsPanelComponent } from './details-panel.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<SankeyDetailsPanelComponent> = {
  title: 'SankeyViewer/Details Panel',
  component: SankeyDetailsPanelComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, RouterTestingModule],
      declarations: [
        MockComponents(SankeyNodeDetailsComponent, SankeyLinkDetailsComponent, SankeyTraceDetailsComponent),
      ],
      providers: [
        { provide: SankeyControllerService, useValue: sankeyControllerStub },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyDetailsPanelComponent>;

export const Empty: Story = {
  args: { details: [] },
};

export const WithNode: Story = {
  args: {
    details: [{ node: { id: 'node1', label: 'Gene A' } as any }],
  },
};
