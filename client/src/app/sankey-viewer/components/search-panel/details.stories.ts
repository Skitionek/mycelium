import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { SankeySearchComponent } from './details.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<SankeySearchComponent> = {
  title: 'SankeyViewer/Search Details',
  component: SankeySearchComponent,
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

type Story = StoryObj<SankeySearchComponent>;

export const Default: Story = {
  args: { entity: { id: 'n1', label: 'BRCA1' } },
};
