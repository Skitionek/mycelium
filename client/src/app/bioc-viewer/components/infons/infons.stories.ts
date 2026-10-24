import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { InfonsComponent } from 'app/bioc-viewer/components/infons/infons.component';

const meta: Meta<InfonsComponent> = {
  title: 'BioC Viewer/Infons',
  component: InfonsComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<InfonsComponent>;

export const WithAllFields: Story = {
  args: {
    data: {
      journal: 'Nature',
      year: '2023',
      type: 'article',
      authors: 'Smith J, Doe A',
      section: 'Introduction',
    },
  },
};

export const Minimal: Story = {
  args: {
    data: {
      journal: '',
      year: '2021',
      type: 'abstract',
      authors: '',
      section: '',
    },
  },
};
