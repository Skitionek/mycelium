import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SortLegendComponent } from 'app/shared/components/sort-legend.component';

const meta: Meta<SortLegendComponent> = {
  title: 'Shared/Sort Legend',
  component: SortLegendComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<SortLegendComponent>;

export const Amount: Story = {
  args: {
    order: 1,
    type: 'amount',
  },
};

export const Alphabetical: Story = {
  args: {
    order: 1,
    type: 'alpha',
  },
};

export const Numeric: Story = {
  args: {
    order: 1,
    type: 'numeric',
  },
};

/** `order` is undefined, so the icon is not rendered at all. */
export const Unsorted: Story = {
  args: {
    order: undefined,
    type: 'amount',
  },
};
