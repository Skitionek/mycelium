import { CommonModule } from '@angular/common';

import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockComponents } from 'ng-mocks';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';
import { SankeyNodeDetailsComponent } from 'app/sankey-viewer/components/details-panel/node-details.component';
import { SankeyTraceDetailsComponent } from 'app/sankey-viewer/components/details-panel/trace-details.component';

import { SankeyManyToManyLinkDetailsComponent } from './link-details.component';
import { SankeyManyToManyDetailsPanelComponent } from './details-panel.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<SankeyManyToManyDetailsPanelComponent> = {
  title: 'SankeyManyToMany/Details Panel',
  component: SankeyManyToManyDetailsPanelComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, RouterTestingModule],
      declarations: [
        MockComponents(
          SankeyNodeDetailsComponent,
          SankeyManyToManyLinkDetailsComponent,
          SankeyTraceDetailsComponent,
        ),
      ],
      providers: [
        { provide: SankeyControllerService, useValue: sankeyControllerStub },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyManyToManyDetailsPanelComponent>;

export const Empty: Story = {
  args: { details: [] },
};

export const WithNode: Story = {
  args: {
    details: [{ node: { id: 'node1', label: 'BRCA1' } } as any],
  },
};
