import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SelectComponent } from 'app/shared/components/form/select.component';

const meta: Meta<SelectComponent<string>> = {
  title: 'Shared/Form/Select',
  component: SelectComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<SelectComponent<string>>;

export const NoneSelected: Story = {
  args: {
    choices: ['Option A', 'Option B', 'Option C'],
    values: [],
    emptyLabel: 'All',
    allLabel: 'All',
    choiceLabel: (c) => c,
  },
};

export const SomeSelected: Story = {
  args: {
    choices: ['Option A', 'Option B', 'Option C'],
    values: ['Option A', 'Option C'],
    emptyLabel: 'All',
    allLabel: 'All',
    choiceLabel: (c) => c,
  },
};

export const AllSelected: Story = {
  args: {
    choices: ['Option A', 'Option B', 'Option C'],
    values: ['Option A', 'Option B', 'Option C'],
    emptyLabel: 'All',
    allLabel: 'All',
    choiceLabel: (c) => c,
  },
};
