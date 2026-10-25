import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider, MockComponents } from 'ng-mocks';

import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { LinkEditDialogComponent } from 'app/drawing-tool/components/map-editor/dialog/link-edit-dialog.component';

import { LinksPanelComponent } from './links-panel.component';

const meta: Meta<LinksPanelComponent> = {
  title: 'DrawingTool/Links Panel',
  component: LinksPanelComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, NgbModule],
      declarations: [MockComponents(LinkEditDialogComponent)],
      providers: [
        MockProvider(DataTransferDataService),
        MockProvider(WorkspaceManager),
        MockProvider(MessageDialog),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<LinksPanelComponent>;

export const Empty: Story = {
  args: {
    title: 'Links',
    singularTitle: 'Link',
    showHeader: true,
    editable: true,
    value: [],
  },
};

export const WithLinks: Story = {
  args: {
    title: 'Sources',
    singularTitle: 'Source',
    showHeader: true,
    editable: false,
    value: [
      { domain: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/12345' },
      { domain: 'UniProt', url: 'https://uniprot.org/P12345' },
    ],
  },
};

export const Editable: Story = {
  args: {
    title: 'Hyperlinks',
    singularTitle: 'Hyperlink',
    showHeader: true,
    editable: true,
    draggable: true,
    value: [{ domain: 'Example', url: 'https://example.com' }],
  },
};
