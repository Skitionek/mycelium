import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { HighlightSnippetComponent } from 'app/shared/components/highlight-snippet.component';

const meta: Meta<HighlightSnippetComponent> = {
  title: 'Shared/Highlight Snippet',
  component: HighlightSnippetComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, BrowserModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<HighlightSnippetComponent>;

export const WithHighlights: Story = {
  args: {
    snippet: 'Inhibition of MAPK1 by Aspirin reduced cancer cell growth.',
    entry1Text: 'MAPK1',
    entry2Text: 'Aspirin',
    entry1Type: 'Gene',
    entry2Type: 'Chemical',
    legend: new Map([
      ['Gene', ['#3498db', '#2980b9']],
      ['Chemical', ['#e74c3c', '#c0392b']],
    ]),
  },
};

export const NoHighlights: Story = {
  args: {
    snippet: 'The study found no significant results.',
    entry1Text: 'MAPK1',
    entry2Text: 'Aspirin',
    entry1Type: 'Gene',
    entry2Type: 'Chemical',
    legend: new Map(),
  },
};
