import { CommonModule } from '@angular/common';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { CopyLinkDialogComponent } from 'app/shared/components/dialog/copy-link-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { AutoFocusDirective } from 'app/shared/directives/auto-focus.directive';
import { MODAL_DECLARATIONS, modalDialogWrapper } from 'app/shared/storybook/modal-dialog';

const meta: Meta<CopyLinkDialogComponent> = {
  title: 'Shared/Copy Link Dialog',
  component: CopyLinkDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, MatSnackBarModule],
      declarations: [...MODAL_DECLARATIONS, AutoFocusDirective],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
      ],
    }),
    modalDialogWrapper,
  ],
};

export default meta;

type Story = StoryObj<CopyLinkDialogComponent>;

export const Default: Story = {
  args: {
    url: 'https://example.com/share/abc123',
  },
};
