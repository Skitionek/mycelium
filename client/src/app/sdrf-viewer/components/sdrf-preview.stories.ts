import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SdrfPreviewComponent } from 'app/sdrf-viewer/components/sdrf-preview.component';
import { SdrfDocument } from 'app/sdrf-viewer/models/sdrf-document';

const meta: Meta<SdrfPreviewComponent> = {
  title: 'SDRF Viewer/Preview',
  component: SdrfPreviewComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<SdrfPreviewComponent>;

export const SmallTable: Story = {
  args: {
    document: SdrfDocument.fromText(
      [
        'source name\tcharacteristics[organism]\tcomment[data file]',
        'sample1\tHomo sapiens\tfile1.raw',
        'sample2\tHomo sapiens\tfile2.raw',
        'sample3\tMus musculus\tfile3.raw',
      ].join('\n'),
    ),
  },
};

export const ManyRows: Story = {
  args: {
    document: SdrfDocument.fromText(
      [
        'source name\tcharacteristics[organism]\ttechnology type',
        ...Array.from({ length: 10 }, (_, i) => `sample${i + 1}\tHomo sapiens\tproteomic`),
      ].join('\n'),
    ),
  },
};

export const Empty: Story = {
  args: {
    document: SdrfDocument.fromText('source name\n'),
  },
};
