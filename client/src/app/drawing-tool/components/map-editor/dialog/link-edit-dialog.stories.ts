import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { MessageDialog } from 'app/shared/services/message-dialog.service';

import { LinkEditDialogComponent } from './link-edit-dialog.component';

const meta: Meta<LinkEditDialogComponent> = {
  title: 'DrawingTool/Link Edit Dialog',
  component: LinkEditDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, NgbModule],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<LinkEditDialogComponent>;

export const NewLink: Story = {
  args: { title: 'Add Link' },
};

export const EditLink: Story = {
  args: {
    title: 'Edit Link',
    link: { domain: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/12345' },
  },
};
