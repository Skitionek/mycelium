import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { VisJsNetworkComponent } from 'app/shared/components/vis-js-network/vis-js-network.component';

const meta: Meta<VisJsNetworkComponent> = {
  title: 'Shared/Vis-JS Network',
  component: VisJsNetworkComponent,

  // vis.js renders into a canvas/WebGL context; the screenshot cannot
  // meaningfully assert the graph layout across render cycles.
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [],
    }),
  ],
};

export default meta;

type Story = StoryObj<VisJsNetworkComponent>;

export const Default: Story = {
  args: {
    config: {
      physics: {
        enabled: false,
        solver: 'barnesHut',
      },
      edges: {
        smooth: false,
      },
    },
    graphData: {
      nodes: [
        { id: 1, label: 'Node A' },
        { id: 2, label: 'Node B' },
        { id: 3, label: 'Node C' },
      ],
      edges: [
        { id: 'e1', from: 1, to: 2 },
        { id: 'e2', from: 2, to: 3 },
      ],
    } as any,
  },
};
