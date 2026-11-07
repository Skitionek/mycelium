import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { FormInputFeedbackComponent } from 'app/shared/components/form/form-input-feedback.component';
import { FormRowComponent } from 'app/shared/components/form/form-row.component';
import { AutoFocusDirective } from 'app/shared/directives/auto-focus.directive';
import { FormInputDirective } from 'app/shared/directives/form-input.directive';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { MODAL_DECLARATIONS, modalDialogWrapper } from 'app/shared/storybook/modal-dialog';

import { LinkEditDialogComponent } from './link-edit-dialog.component';

const meta: Meta<LinkEditDialogComponent> = {
  title: 'DrawingTool/Link Edit Dialog',
  component: LinkEditDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, NgbModule],
      declarations: [
        ...MODAL_DECLARATIONS,
        FormRowComponent,
        FormInputFeedbackComponent,
        FormInputDirective,
        AutoFocusDirective,
      ],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
      ],
    }),
    modalDialogWrapper,
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
