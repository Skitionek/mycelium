import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { QuickSearchComponent } from 'app/shared/components/quick-search.component';

const meta: Meta<QuickSearchComponent> = {
  title: 'Shared/Quick Search',
  component: QuickSearchComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<QuickSearchComponent>;

export const WithQuery: Story = {
  args: {
    query: 'MAPK1',
    links: undefined,
  },
};

export const WithLinks: Story = {
  args: {
    query: undefined,
    links: [
      { domain: 'NCBI_Gene', url: 'https://www.ncbi.nlm.nih.gov/gene/?term=MAPK1' },
      { domain: 'UniProt', url: 'https://www.uniprot.org/uniprot/?query=MAPK1' },
    ],
  },
};

export const Empty: Story = {
  args: {
    query: undefined,
    links: undefined,
  },
};
