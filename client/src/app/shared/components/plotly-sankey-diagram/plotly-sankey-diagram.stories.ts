import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { PlotlySankeyDiagramComponent } from 'app/shared/components/plotly-sankey-diagram/plotly-sankey-diagram.component';

const meta: Meta<PlotlySankeyDiagramComponent> = {
  title: 'Shared/Plotly Sankey Diagram',
  component: PlotlySankeyDiagramComponent,

  // Plotly renders into a canvas; a PNG cannot assert useful structure and the
  // rendering depends on the Plotly script loaded at runtime.
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

type Story = StoryObj<PlotlySankeyDiagramComponent>;

export const Default: Story = {
  args: {
    data: {
      type: 'sankey',
      node: {
        label: ['A', 'B', 'C'],
        color: ['blue', 'green', 'red'],
      },
      link: {
        source: [0, 1],
        target: [1, 2],
        value: [5, 3],
      },
    },
    config: { responsive: true },
    legend: new Map([
      ['A', ['blue', '#0000ff']],
      ['B', ['green', '#00ff00']],
    ]),
  },
};
