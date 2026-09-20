import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { BaseControlComponent } from 'app/shared/components/base-control.component';

const meta: Meta<BaseControlComponent> = {
  title: 'Shared/Base Control',
  component: BaseControlComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
    }),
    componentWrapperDecorator((story) => `<div style="width: 420px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<BaseControlComponent>;

const template = `
  <app-base-control [disabled]="disabled" [resultIndex]="resultIndex"
                    [resultCount]="resultCount" [searching]="searching">
    <input type="text" class="form-control" value="kinase">
  </app-base-control>`;

export const WithResults: Story = {
  render: (args) => ({ props: args, template }),
  args: {
    disabled: false,
    resultIndex: 2,
    resultCount: 17,
    searching: false,
  },
};

/** While searching, a spinner sits beside the result counter. */
export const Searching: Story = {
  render: (args) => ({ props: args, template }),
  args: {
    disabled: false,
    resultIndex: 0,
    resultCount: 17,
    searching: true,
  },
};

/** With no results the counter is hidden and every button is disabled. */
export const NoResults: Story = {
  render: (args) => ({ props: args, template }),
  args: {
    disabled: false,
    resultIndex: 0,
    resultCount: 0,
    searching: false,
  },
};

export const Disabled: Story = {
  render: (args) => ({ props: args, template }),
  args: {
    disabled: true,
    resultIndex: 2,
    resultCount: 17,
    searching: false,
  },
};
