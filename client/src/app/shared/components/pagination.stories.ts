import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { PaginationComponent } from 'app/shared/components/pagination.component';
import { PaginatedRequestOptions } from 'app/shared/schemas/common';

const meta: Meta<PaginationComponent<PaginatedRequestOptions>> = {
  title: 'Shared/Pagination',
  component: PaginationComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<PaginationComponent<PaginatedRequestOptions>>;

export const FirstPage: Story = {
  args: {
    paging: { page: 1, limit: 20 },
    collectionSize: 137,
    alwaysShow: false,
  },
};

export const MiddlePage: Story = {
  args: {
    paging: { page: 4, limit: 20 },
    collectionSize: 137,
    alwaysShow: false,
  },
};

/** One page of results hides the control unless `alwaysShow` is set. */
export const SinglePageHidden: Story = {
  args: {
    paging: { page: 1, limit: 20 },
    collectionSize: 5,
    alwaysShow: false,
  },
};

export const SinglePageForced: Story = {
  args: {
    paging: { page: 1, limit: 20 },
    collectionSize: 5,
    alwaysShow: true,
  },
};

/** Before paging arrives, a greyed-out placeholder holds the layout. */
export const LoadingPlaceholder: Story = {
  args: {
    paging: undefined,
    collectionSize: 0,
    alwaysShow: false,
  },
};
