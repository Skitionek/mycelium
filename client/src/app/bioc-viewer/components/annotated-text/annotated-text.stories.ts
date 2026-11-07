import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { AnnotatedTextComponent } from 'app/bioc-viewer/components/annotated-text/annotated-text.component';

const meta: Meta<AnnotatedTextComponent> = {
  title: 'BioC Viewer/Annotated Text',
  component: AnnotatedTextComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<AnnotatedTextComponent>;

export const PlainText: Story = {
  args: {
    text: 'Inhibition of MAPK1 reduced tumor growth significantly.',
    annotations: [],
    offset: 0,
    position: 0,
  },
};

export const WithAnnotations: Story = {
  args: {
    text: 'Inhibition of MAPK1 reduced tumor growth significantly.',
    annotations: [
      {
        id: 'ann1',
        text: 'MAPK1',
        infons: {
          type: 'Gene',
          identifier: '5594',
        },
        locations: [{ offset: 14, length: 5 }],
      },
    ],
    offset: 0,
    position: 1,
  },
};
