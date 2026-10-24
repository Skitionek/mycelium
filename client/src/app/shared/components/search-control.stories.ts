import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SearchControlComponent } from 'app/shared/components/search-control.component';

const meta: Meta<SearchControlComponent> = {
  title: 'Shared/Search Control',
  component: SearchControlComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<SearchControlComponent>;

export const Searching: Story = {
  args: {
    disabled: false,
    searching: true,
    resultIndex: 0,
    resultCount: 0,
  },
};

export const WithResults: Story = {
  args: {
    disabled: false,
    searching: false,
    resultIndex: 2,
    resultCount: 5,
  },
};

export const NoResults: Story = {
  args: {
    disabled: false,
    searching: false,
    resultIndex: 0,
    resultCount: 0,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    searching: false,
    resultIndex: 0,
    resultCount: 0,
  },
};
