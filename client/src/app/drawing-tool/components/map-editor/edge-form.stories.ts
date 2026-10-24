import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider, MockComponents } from 'ng-mocks';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InfoPanel } from 'app/drawing-tool/models/info-panel';
import { LinksPanelComponent } from 'app/drawing-tool/components/links-panel.component';

import { EdgeFormComponent } from './edge-form.component';

const meta: Meta<EdgeFormComponent> = {
  title: 'DrawingTool/Edge Form',
  component: EdgeFormComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
      declarations: [MockComponents(LinksPanelComponent)],
      providers: [MockProvider(WorkspaceManager)],
    }),
  ],
};

export default meta;

type Story = StoryObj<EdgeFormComponent>;

export const Default: Story = {
  args: {
    infoPanel: new InfoPanel(),
    edge: {
      label: 'activates',
      from: 'node1',
      to: 'node2',
      data: { hyperlinks: [], detail: '' },
      style: {},
    } as any,
  },
};
