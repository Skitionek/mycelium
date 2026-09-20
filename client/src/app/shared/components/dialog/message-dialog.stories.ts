import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { MessageDialogComponent } from 'app/shared/components/dialog/message-dialog.component';
import { ModalBodyComponent } from 'app/shared/components/modal/modal-body.component';
import { ModalFooterComponent } from 'app/shared/components/modal/modal-footer.component';
import { ModalHeaderComponent } from 'app/shared/components/modal/modal-header.component';
import { MessageType } from 'app/interfaces/message-dialog.interface';

const meta: Meta<MessageDialogComponent> = {
  title: 'Shared/Dialog/Message Dialog',
  component: MessageDialogComponent,
  decorators: [
    moduleMetadata({
      declarations: [ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent],
      imports: [CommonModule, FormsModule],
      providers: [
        { provide: NgbActiveModal, useValue: { close: () => undefined, dismiss: () => undefined } },
      ],
    }),
    componentWrapperDecorator(
      (story) => `
        <div class="modal d-block position-relative">
          <div class="modal-dialog"><div class="modal-content">${story}</div></div>
        </div>`,
    ),
  ],
};

export default meta;

type Story = StoryObj<MessageDialogComponent>;

export const Info: Story = {
  args: {
    title: 'Export started',
    message: 'Your export will download when it is ready.',
    additionalMsgs: [],
    stacktrace: null,
    transactionId: null,
    type: MessageType.Info,
  },
};

export const WithAdditionalMessages: Story = {
  args: {
    ...Info.args,
    title: 'Could not save',
    message: 'The file was not saved.',
    additionalMsgs: ['The server rejected the filename.', 'Try removing special characters.'],
    type: MessageType.Error,
  },
};

/** A stacktrace renders in a separate monospaced technical-details block. */
export const WithStacktrace: Story = {
  args: {
    ...Info.args,
    title: 'Unexpected error',
    message: 'Something went wrong.',
    stacktrace: 'Traceback (most recent call last):\n  File "app.py", line 42\n    raise ValueError',
    transactionId: 'txn-0001',
    type: MessageType.Error,
  },
};
