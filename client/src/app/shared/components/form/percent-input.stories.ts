import { componentWrapperDecorator, Meta, StoryObj } from '@storybook/angular';

import { PercentInputComponent } from 'app/shared/components/form/percent-input.component';

const meta: Meta<PercentInputComponent> = {
  title: 'Shared/Form/Percent Input',
  component: PercentInputComponent,
  decorators: [
    componentWrapperDecorator((story) => `<div style="width: 220px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<PercentInputComponent>;

/** The bound value is a fraction; the input shows it multiplied by 100. */
export const Default: Story = {
  args: {
    inputId: 'threshold',
    value: 0.42,
    default: '',
    min: 0,
    max: 100,
    step: 1,
  },
};

/** With no value the `default` string is shown instead. */
export const Empty: Story = {
  args: {
    inputId: 'threshold',
    value: null,
    default: '',
    min: 0,
    max: 100,
    step: 1,
  },
};
