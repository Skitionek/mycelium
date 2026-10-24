import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { SankeyDetailsComponent } from './details.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<SankeyDetailsComponent> = {
  title: 'SankeyViewer/Details',
  component: SankeyDetailsComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule],
      providers: [
        { provide: SankeyControllerService, useValue: sankeyControllerStub },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyDetailsComponent>;

export const Default: Story = {
  args: { entity: { id: 'n1', label: 'Node A' } },
};
