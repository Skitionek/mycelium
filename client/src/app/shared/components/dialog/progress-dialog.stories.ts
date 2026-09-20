import { CommonModule } from '@angular/common';

import { NgbActiveModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ProgressDialogComponent } from 'app/shared/components/dialog/progress-dialog.component';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';

const meta: Meta<ProgressDialogComponent> = {
  title: 'Shared/Dialog/Progress Dialog',
  component: ProgressDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
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

type Story = StoryObj<ProgressDialogComponent>;

/**
 * A single fixed emission rather than a live stream, so the bar is always at
 * the same position when the screenshot is taken.
 */
export const Determinate: Story = {
  args: {
    title: 'Uploading files',
    progressObservable: of(
      new Progress({ mode: ProgressMode.Determinate, value: 0.45, status: 'Uploading 3 of 7…' }),
    ),
    cancellable: false,
  },
};

/** An indeterminate task shows a striped bar; the stripes are frozen. */
export const Indeterminate: Story = {
  args: {
    title: 'Preparing export',
    progressObservable: of(
      new Progress({ mode: ProgressMode.Indeterminate, value: 0, status: 'Working…' }),
    ),
    cancellable: false,
  },
};

export const Cancellable: Story = {
  args: {
    ...Determinate.args,
    cancellable: true,
  },
};
