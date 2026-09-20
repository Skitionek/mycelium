import { CommonModule } from '@angular/common';

import { Subscription } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { HighlightTextComponent } from 'app/shared/components/highlight-text.component';
import { HighlightTextService } from 'app/shared/services/highlight-text.service';

/**
 * The real service rewrites the custom `<snippet>`/`<highlight>` markup into
 * app-specific elements and wires click handlers to the workspace. Neither is
 * what this component renders, so the stub keeps the markup verbatim.
 */
const highlightTextServiceStub: Partial<HighlightTextService> = {
  generateHTML: (source: string) =>
    source.replace(/<snippet>|<\/snippet>/g, '').replace(/<highlight>/g, '<mark>').replace(
      /<\/highlight>/g,
      '</mark>',
    ),
  addEventListeners: () => new Subscription(),
};

const meta: Meta<HighlightTextComponent> = {
  title: 'Shared/Highlight Text',
  component: HighlightTextComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      providers: [{ provide: HighlightTextService, useValue: highlightTextServiceStub }],
    }),
  ],
};

export default meta;

type Story = StoryObj<HighlightTextComponent>;

export const WithHighlight: Story = {
  args: {
    highlight: '<snippet>Inhibition of <highlight>MAPK1</highlight> reduced growth.</snippet>',
    eventSubscriptions: false,
  },
};

export const WithoutHighlight: Story = {
  args: {
    highlight: '<snippet>Inhibition reduced growth.</snippet>',
    eventSubscriptions: false,
  },
};
