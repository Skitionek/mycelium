import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { InternalSearchService } from 'app/shared/services/internal-search.service';
import {
  GraphEntityType,
  UniversalGraphNode,
  UniversalGraphEdge,
} from 'app/drawing-tool/services/interfaces';

import { InfoViewPanelComponent } from './info-view-panel.component';

const meta: Meta<InfoViewPanelComponent> = {
  title: 'DrawingTool/Info View Panel',
  component: InfoViewPanelComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      providers: [MockProvider(InternalSearchService)],
    }),
  ],
};

export default meta;

type Story = StoryObj<InfoViewPanelComponent>;

const nodeEntity = {
  type: GraphEntityType.Node,
  entity: {
    display_name: 'MAPK1',
    hash: 'abc123',
    label: 'gene',
    sub_labels: [],
    data: { x: 0, y: 0 },
  } as UniversalGraphNode,
};

const edgeEntity = {
  type: GraphEntityType.Edge,
  entity: {
    label: 'activates',
    from: 'node1',
    to: 'node2',
    data: {},
  } as UniversalGraphEdge,
};

export const WithNode: Story = {
  args: { selected: nodeEntity },
};

export const WithEdge: Story = {
  args: { selected: edgeEntity },
};
