import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider, MockComponents } from 'ng-mocks';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InfoPanel } from 'app/drawing-tool/models/info-panel';
import {
  GraphEntityType,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';

import { NodeFormComponent } from './node-form.component';
import { EdgeFormComponent } from './edge-form.component';
import { InfoPanelComponent } from './info-panel.component';

const meta: Meta<InfoPanelComponent> = {
  title: 'DrawingTool/Info Panel',
  component: InfoPanelComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      declarations: [MockComponents(NodeFormComponent, EdgeFormComponent)],
      providers: [MockProvider(WorkspaceManager)],
    }),
  ],
};

export default meta;

type Story = StoryObj<InfoPanelComponent>;

export const WithNode: Story = {
  args: {
    infoPanel: new InfoPanel(),
    selected: {
      type: GraphEntityType.Node,
      entity: {
        display_name: 'MAPK1',
        hash: 'abc',
        label: 'gene',
        sub_labels: [],
        data: { x: 100, y: 100 },
      } as UniversalGraphNode,
    },
  },
};

export const NoSelection: Story = {
  args: {
    infoPanel: new InfoPanel(),
    selected: undefined,
  },
};
