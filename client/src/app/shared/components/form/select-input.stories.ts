import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SelectInputComponent } from 'app/shared/components/form/select-input.component';
import { MouseNavigableDirective } from 'app/shared/directives/mouse-navigable.directive';

interface StringChoice {
  label: string;
}

const meta: Meta<SelectInputComponent<StringChoice>> = {
  title: 'Shared/Form/Select Input',
  component: SelectInputComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      declarations: [MouseNavigableDirective],
    }),
  ],
};

export default meta;

type Story = StoryObj<SelectInputComponent<StringChoice>>;

export const WithChoices: Story = {
  args: {
    choices: [{ label: 'Alpha' }, { label: 'Beta' }, { label: 'Gamma' }],
    placeholder: 'Select an item',
    multiple: false,
    loading: false,
  },
};

export const MultipleSelection: Story = {
  args: {
    choices: [{ label: 'Alpha' }, { label: 'Beta' }, { label: 'Gamma' }],
    placeholder: 'Select items',
    multiple: true,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    choices: [],
    placeholder: 'Search...',
    loading: true,
    multiple: false,
  },
};

export const NoResults: Story = {
  args: {
    choices: [],
    placeholder: 'Search...',
    loading: false,
    noResultsText: 'No matching items',
    multiple: false,
  },
};
