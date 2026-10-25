import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { SankeyTraceDetailsComponent } from './trace-details.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<SankeyTraceDetailsComponent> = {
  title: 'SankeyViewer/Trace Details',
  component: SankeyTraceDetailsComponent,
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

type Story = StoryObj<SankeyTraceDetailsComponent>;

export const Default: Story = {
  args: {
    entity: { source: 'BRCA1', target: 'TP53' },
  },
};
