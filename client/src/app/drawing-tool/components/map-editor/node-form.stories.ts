import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider, MockComponents } from 'ng-mocks';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { InfoPanel } from 'app/drawing-tool/models/info-panel';
import { LinksPanelComponent } from 'app/drawing-tool/components/links-panel.component';

import { NodeFormComponent } from './node-form.component';

const meta: Meta<NodeFormComponent> = {
  title: 'DrawingTool/Node Form',
  component: NodeFormComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
      declarations: [MockComponents(LinksPanelComponent)],
      providers: [
        MockProvider(WorkspaceManager),
        MockProvider(InternalSearchService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<NodeFormComponent>;

export const Default: Story = {
  args: {
    infoPanel: new InfoPanel(),
    node: {
      display_name: 'MAPK1',
      hash: 'abc',
      label: 'gene',
      sub_labels: [],
      data: { x: 100, y: 100, detail: '', hyperlinks: [] },
      style: {},
    } as any,
  },
};
