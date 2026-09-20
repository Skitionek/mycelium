import { componentWrapperDecorator, Meta, StoryObj } from '@storybook/angular';

import { ModalFooterComponent } from 'app/shared/components/modal/modal-footer.component';

const meta: Meta<ModalFooterComponent> = {
  title: 'Shared/Modal/Modal Footer',
  component: ModalFooterComponent,
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

type Story = StoryObj<ModalFooterComponent>;

export const Default: Story = {
  render: () => ({
    template:
      '<app-modal-footer>' +
      '<button type="button" class="btn btn-secondary">Cancel</button>' +
      '<button type="button" class="btn btn-primary">Delete</button>' +
      '</app-modal-footer>',
  }),
};
