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

import { SankeyViewCreateComponent } from './view-create.component';

const meta: Meta<SankeyViewCreateComponent> = {
  title: 'SharedSankey/View Create',
  component: SankeyViewCreateComponent,
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

type Story = StoryObj<SankeyViewCreateComponent>;

export const Default: Story = {};
