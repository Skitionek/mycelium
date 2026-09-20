import { CommonModule } from '@angular/common';

import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { NodeRelationshipComponent } from 'app/shared/components/node-relationship-display.component';

const meta: Meta<NodeRelationshipComponent> = {
  title: 'Shared/Node Relationship',
  component: NodeRelationshipComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, MatLegacyTooltipModule],
    }),
    componentWrapperDecorator((story) => `<div style="width: 620px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<NodeRelationshipComponent>;

export const Default: Story = {
  args: {
    leftNodeName: 'MAPK1',
    leftNodeLabel: 'Gene',
    leftNodeColor: '#673ab7',
    leftNodeUrl: 'https://www.ncbi.nlm.nih.gov/gene/5594',
    rightNodeName: 'Imatinib',
    rightNodeLabel: 'Chemical',
    rightNodeColor: '#4caf50',
    rightNodeUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/5291',
    edge: 'inhibits',
    snippets: [],
  },
};

/** A node with no resolved URL renders plain text plus an inline warning. */
export const MissingUrl: Story = {
  args: {
    ...Default.args,
    rightNodeUrl: undefined,
  },
};
