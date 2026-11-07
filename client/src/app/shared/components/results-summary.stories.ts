import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ResultsSummaryComponent } from 'app/shared/components/results-summary.component';

const meta: Meta<ResultsSummaryComponent> = {
  title: 'Shared/Results Summary',
  component: ResultsSummaryComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<ResultsSummaryComponent>;

export const FirstPage: Story = {
  args: {
    page: 1,
    pageSize: 20,
    collectionSize: 137,
  },
};

export const LastPartialPage: Story = {
  args: {
    page: 7,
    pageSize: 20,
    collectionSize: 137,
  },
};

export const SingleResult: Story = {
  args: {
    page: 1,
    pageSize: 20,
    collectionSize: 1,
  },
};

/** When the backend caps the count, the total is shown as `1000+`. */
export const CountLimited: Story = {
  args: {
    page: 1,
    pageSize: 20,
    collectionSize: 5000,
    resultCountLimited: true,
    resultLimit: 1000,
  },
};
