import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockComponents } from 'ng-mocks';

import { TraceDetailsComponent } from 'app/trace-viewer/components/trace-details.component';
import { VisJsNetworkComponent } from 'app/shared/components/vis-js-network/vis-js-network.component';
import { ObjectExplorerComponent } from 'app/shared/components/object-explorer/object-explorer.component';

const meta: Meta<TraceDetailsComponent> = {
  title: 'Trace Viewer/Trace Details',
  component: TraceDetailsComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      declarations: [MockComponents(VisJsNetworkComponent, ObjectExplorerComponent)],
    }),
  ],
};

export default meta;

type Story = StoryObj<TraceDetailsComponent>;

export const Default: Story = {
  args: {
    data: {
      nodes: [
        { id: 1, label: 'MAPK1', type: 'gene', fullLabel: 'MAPK1', labelShort: 'MAPK1' },
        { id: 2, label: 'TP53', type: 'gene', fullLabel: 'TP53', labelShort: 'TP53' },
      ],
      edges: [
        { id: 'e1', from: 1, to: 2, label: 'activates', arrows: 'to', color: 'black' },
      ],
    },
  },
};
