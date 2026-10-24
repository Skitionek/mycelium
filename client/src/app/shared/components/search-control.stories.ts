import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { BaseControlComponent } from 'app/shared/components/base-control.component';
import { SearchControlComponent } from 'app/shared/components/search-control.component';

const meta: Meta<SearchControlComponent> = {
  title: 'Shared/Search Control',
  component: SearchControlComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule, NgbModule],
      // Draws the result counter, spinner and navigation buttons.
      declarations: [BaseControlComponent],
    }),
    componentWrapperDecorator((story) => `<div style="width: 420px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<SearchControlComponent>;

/** The spinner sits inside the result counter, so it needs results to show. */
export const Searching: Story = {
  args: {
    disabled: false,
    searching: true,
    resultIndex: 0,
    resultCount: 3,
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
