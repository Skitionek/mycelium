import { CommonModule } from '@angular/common';

import { Subscription } from 'rxjs';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { GenericTableComponent } from 'app/shared/components/table/generic-table.component';
import { HighlightTextComponent } from 'app/shared/components/highlight-text.component';
import { HighlightTextService } from 'app/shared/services/highlight-text.service';

const highlightTextServiceStub: Partial<HighlightTextService> = {
  generateHTML: (source: string) =>
    source.replace(/<snippet>|<\/snippet>/g, '').replace(/<highlight>/g, '<mark>').replace(
      /<\/highlight>/g,
      '</mark>',
    ),
  addEventListeners: () => new Subscription(),
};

const meta: Meta<GenericTableComponent> = {
  title: 'Shared/Table/Generic Table',
  component: GenericTableComponent,
  decorators: [
    moduleMetadata({
      declarations: [HighlightTextComponent],
      imports: [CommonModule],
      providers: [{ provide: HighlightTextService, useValue: highlightTextServiceStub }],
    }),
    componentWrapperDecorator((story) => `<div style="width: 760px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<GenericTableComponent>;

export const Default: Story = {
  args: {
    header: [[{ name: 'Gene', span: '1' }, { name: 'Organism', span: '1' }, { name: 'Score', span: '1' }]],
    entries: [
      [{ text: 'MAPK1' }, { text: 'Escherichia coli' }, { text: '0.91' }],
      [{ text: 'PIK3CA' }, { text: 'Escherichia coli' }, { text: '0.76' }],
    ],
  },
};

/** A header row can span several columns above a second row of headers. */
export const GroupedHeader: Story = {
  args: {
    header: [
      [{ name: 'Identity', span: '2' }, { name: 'Result', span: '1' }],
      [{ name: 'Gene', span: '1' }, { name: 'Organism', span: '1' }, { name: 'Score', span: '1' }],
    ],
    entries: Default.args.entries,
  },
};

/** `highlight` marks a cell as an error. */
export const HighlightedCell: Story = {
  args: {
    header: Default.args.header,
    entries: [
      [{ text: 'MAPK1' }, { text: 'Escherichia coli' }, { text: '0.91' }],
      [{ text: 'PIK3CA' }, { text: 'unmatched', highlight: true }, { text: '0.76' }],
    ],
  },
};

/** Cells can carry a list of outbound links. */
export const WithLinks: Story = {
  args: {
    header: [[{ name: 'Gene', span: '1' }, { name: 'References', span: '1' }]],
    entries: [
      [
        { text: 'MAPK1' },
        {
          text: '',
          multiLink: [
            { link: 'https://www.ncbi.nlm.nih.gov/gene/5594', linkText: 'NCBI 5594' },
            { link: 'https://www.uniprot.org/uniprot/P28482', linkText: 'UniProt P28482' },
          ],
        },
      ],
    ],
  },
};
