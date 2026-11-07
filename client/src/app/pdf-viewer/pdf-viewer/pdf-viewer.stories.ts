import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { PdfViewerComponent } from 'app/pdf-viewer/pdf-viewer/pdf-viewer.component';

const meta: Meta<PdfViewerComponent> = {
  title: 'PDF Viewer/PDF Viewer Core',
  component: PdfViewerComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [],
    }),
  ],
};

export default meta;

type Story = StoryObj<PdfViewerComponent>;

export const Default: Story = {
  args: {
    page: 1,
  },
};
