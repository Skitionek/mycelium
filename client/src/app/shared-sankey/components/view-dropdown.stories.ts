import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';
import { CustomisedSankeyLayoutService } from 'app/sankey-viewer/services/customised-sankey-layout.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { SankeySearchService } from 'app/sankey-viewer/services/search.service';

import { SankeyViewDropdownComponent } from './view-dropdown.component';

const meta: Meta<SankeyViewDropdownComponent> = {
  title: 'SharedSankey/View Dropdown',
  component: SankeyViewDropdownComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
      providers: [
        MockProvider(SankeyControllerService),
        MockProvider(CustomisedSankeyLayoutService),
        MockProvider(WorkspaceManager),
        MockProvider(WarningControllerService),
        MockProvider(SankeySearchService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyViewDropdownComponent>;

export const NoViews: Story = {
  args: {
    views: {},
    object: null,
  },
};

export const WithViews: Story = {
  args: {
    views: {
      'default': { name: 'Default View', base: 'sankey_base_view' } as any,
      'custom1': { name: 'Custom View 1', base: 'sankey_base_view' } as any,
    },
    object: null,
  },
};
