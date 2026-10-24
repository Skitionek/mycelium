import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { MessageDialog } from 'app/shared/services/message-dialog.service';

import { SankeyViewCreateComponent } from './view-create.component';

const meta: Meta<SankeyViewCreateComponent> = {
  title: 'SharedSankey/View Create',
  component: SankeyViewCreateComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, NgbModule],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyViewCreateComponent>;

export const Default: Story = {};
