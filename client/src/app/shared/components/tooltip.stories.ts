import { componentWrapperDecorator, Meta, StoryObj } from '@storybook/angular';

import { TooltipComponent } from 'app/shared/components/tooltip.component';

const meta: Meta<TooltipComponent> = {
  title: 'Shared/Tooltip',
  component: TooltipComponent,
  decorators: [
    // Popper positions the tooltip against a virtual element at the origin, so
    // it needs a positioned container to sit in.
    componentWrapperDecorator(
      (story) => `<div class="position-relative" style="height: 120px; width: 320px">${story}</div>`,
    ),
  ],
};

export default meta;

type Story = StoryObj<TooltipComponent>;

/**
 * This is the base class other tooltips extend; on its own it renders the
 * placeholder body and points `tooltipSelector` at its own element.
 */
export const Default: Story = {
  args: {
    tooltipOptions: {},
  },
  render: (args) => ({
    props: {
      ...args,
      tooltipSelector: 'tooltip',
    },
  }),
};
