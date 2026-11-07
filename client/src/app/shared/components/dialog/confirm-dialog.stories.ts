import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { ModalBodyComponent } from 'app/shared/components/modal/modal-body.component';
import { ModalFooterComponent } from 'app/shared/components/modal/modal-footer.component';
import { ModalHeaderComponent } from 'app/shared/components/modal/modal-header.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

const meta: Meta<ConfirmDialogComponent> = {
  title: 'Shared/Dialog/Confirm Dialog',
  component: ConfirmDialogComponent,
  decorators: [
    moduleMetadata({
      declarations: [ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent],
      imports: [CommonModule, FormsModule],
      providers: [
        // ng-bootstrap normally supplies these when it opens the dialog.
        { provide: NgbActiveModal, useValue: { close: () => undefined, dismiss: () => undefined } },
        { provide: MessageDialog, useValue: { display: () => undefined } },
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

type Story = StoryObj<ConfirmDialogComponent>;

export const Default: Story = {
  args: {
    message: 'Delete "results.pdf"? This cannot be undone.',
  },
};

/** A long message wraps inside the body rather than widening the dialog. */
export const LongMessage: Story = {
  args: {
    message:
      'Deleting this project removes every file and map inside it, for every ' +
      'collaborator, and the operation cannot be undone. Are you sure you want ' +
      'to continue?',
  },
};
