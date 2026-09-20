import { componentWrapperDecorator, Meta, StoryObj } from '@storybook/angular';

import { ModalHeaderComponent } from 'app/shared/components/modal/modal-header.component';

const meta: Meta<ModalHeaderComponent> = {
  title: 'Shared/Modal/Modal Header',
  component: ModalHeaderComponent,
  decorators: [
    // ng-bootstrap renders these inside `.modal > .modal-dialog >
    // .modal-content`. The outer `.modal` matters: it is where Bootstrap 5
    // defines --bs-modal-width, which .modal-dialog's max-width reads.
    componentWrapperDecorator(
      (story) => `
        <div class="modal d-block position-relative">
          <div class="modal-dialog">
            <div class="modal-content">${story}</div>
          </div>
        </div>`,
    ),
  ],
};

export default meta;

type Story = StoryObj<ModalHeaderComponent>;

export const Default: Story = {
  render: () => ({
    template: '<app-modal-header>Delete file</app-modal-header>',
  }),
};

/** The title truncates rather than wrapping or pushing the close button out. */
export const LongTitle: Story = {
  render: () => ({
    template:
      '<app-modal-header>' +
      'Delete &quot;a-very-long-file-name-that-does-not-fit-in-the-modal-header.pdf&quot;' +
      '</app-modal-header>',
  }),
};
