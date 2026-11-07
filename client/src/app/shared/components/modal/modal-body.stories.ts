import { componentWrapperDecorator, Meta, StoryObj } from '@storybook/angular';

import { ModalBodyComponent } from 'app/shared/components/modal/modal-body.component';

const meta: Meta<ModalBodyComponent> = {
  title: 'Shared/Modal/Modal Body',
  component: ModalBodyComponent,
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

type Story = StoryObj<ModalBodyComponent>;

export const Default: Story = {
  render: () => ({
    template: '<app-modal-body>This file will be permanently deleted.</app-modal-body>',
  }),
};
