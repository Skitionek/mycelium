import { CommonModule } from '@angular/common';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { SankeyViewConfirmComponent } from './view-confirm.component';

const meta: Meta<SankeyViewConfirmComponent> = {
  title: 'SharedSankey/View Confirm',
  component: SankeyViewConfirmComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
      providers: [MockProvider(NgbActiveModal)],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyViewConfirmComponent>;

export const Default: Story = {
  args: {
    header: 'Delete View',
    body: 'Are you sure you want to delete this view? This action cannot be undone.',
  },
};
