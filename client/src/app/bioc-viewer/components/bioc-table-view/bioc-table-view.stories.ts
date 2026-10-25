import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { BiocTableViewComponent } from 'app/bioc-viewer/components/bioc-table-view/bioc-table-view.component';
import { AnnotatedTextComponent } from 'app/bioc-viewer/components/annotated-text/annotated-text.component';

const meta: Meta<BiocTableViewComponent> = {
  title: 'BioC Viewer/Table View',
  component: BiocTableViewComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
      // Renders the caption and plain-text table bodies.
      declarations: [AnnotatedTextComponent],
    }),
  ],
};

export default meta;

type Story = StoryObj<BiocTableViewComponent>;

export const TableCaption: Story = {
  args: {
    passage: {
      infons: { type: 'table_caption', id: 'Table 1' },
      text: 'Summary of experimental results.',
      annotations: [],
      offset: 0,
    },
  },
};

export const TableWithXml: Story = {
  args: {
    passage: {
      infons: { type: 'table', xml: '<table><tr><td>Gene</td><td>Count</td></tr><tr><td>MAPK1</td><td>12</td></tr></table>' },
      text: '',
      annotations: [],
      offset: 0,
    },
  },
};

export const TablePlainText: Story = {
  args: {
    passage: {
      infons: { type: 'table' },
      text: 'Gene\tCount\nMAPK1\t12',
      annotations: [],
      offset: 0,
    },
  },
};
