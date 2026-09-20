import { CommonModule } from '@angular/common';

import { Subscription } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { HighlightTextComponent } from 'app/shared/components/highlight-text.component';
import { TermHighlightComponent } from 'app/shared/components/term-highlight.component';
import { HighlightTextService } from 'app/shared/services/highlight-text.service';

const highlightTextServiceStub: Partial<HighlightTextService> = {
  generateHTML: (source: string) =>
    source.replace(/<snippet>|<\/snippet>/g, '').replace(/<highlight>/g, '<mark>').replace(
      /<\/highlight>/g,
      '</mark>',
    ),
  addEventListeners: () => new Subscription(),
};

const meta: Meta<TermHighlightComponent> = {
  title: 'Shared/Term Highlight',
  component: TermHighlightComponent,
  decorators: [
    moduleMetadata({
      declarations: [HighlightTextComponent],
      imports: [CommonModule],
      providers: [{ provide: HighlightTextService, useValue: highlightTextServiceStub }],
    }),
  ],
};

export default meta;

type Story = StoryObj<TermHighlightComponent>;

export const SingleTerm: Story = {
  args: {
    text: 'Inhibition of MAPK1 reduced tumour growth in mice.',
    highlightTerms: ['MAPK1'],
    highlightOptions: {},
  },
};

export const MultipleTerms: Story = {
  args: {
    text: 'Inhibition of MAPK1 reduced tumour growth in mice.',
    highlightTerms: ['MAPK1', 'tumour'],
    highlightOptions: {},
  },
};

/** Without `wholeWord`, a term matches inside longer words too. */
export const PartialMatch: Story = {
  args: {
    text: 'Inhibition of MAPK1 and MAPK12 reduced growth.',
    highlightTerms: ['MAPK1'],
    highlightOptions: {},
  },
};

export const WholeWordOnly: Story = {
  args: {
    text: 'Inhibition of MAPK1 and MAPK12 reduced growth.',
    highlightTerms: ['MAPK1'],
    highlightOptions: { wholeWord: true },
  },
};

/** No terms falls through to the plain-text branch. */
export const NoTerms: Story = {
  args: {
    text: 'Inhibition of MAPK1 reduced tumour growth in mice.',
    highlightTerms: [],
    highlightOptions: {},
  },
};
