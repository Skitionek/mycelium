import { CommonModule } from '@angular/common';

import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { WordCloudComponent } from 'app/shared/components/word-cloud/word-cloud.component';
import { WordCloudFilterEntity } from 'app/interfaces/filter.interface';

/**
 * d3.layout.cloud places each word by walking a spiral from a random start, so
 * two runs over the same data produce different pictures. Replacing
 * Math.random with a fixed generator makes the layout - and therefore the
 * screenshot - reproducible.
 */
function seedRandom(): void {
  let state = 0x2f6e2b1;
  Math.random = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

const terms: WordCloudFilterEntity[] = [
  { id: '1', type: 'Gene', color: '#673ab7', text: 'MAPK1', frequency: 120, shown: true },
  { id: '2', type: 'Gene', color: '#673ab7', text: 'PIK3CA', frequency: 96, shown: true },
  { id: '3', type: 'Chemical', color: '#4caf50', text: 'Imatinib', frequency: 74, shown: true },
  { id: '4', type: 'Chemical', color: '#4caf50', text: 'Glucose', frequency: 58, shown: true },
  { id: '5', type: 'Disease', color: '#ff9800', text: 'Carcinoma', frequency: 41, shown: true },
  { id: '6', type: 'Disease', color: '#ff9800', text: 'Diabetes', frequency: 33, shown: true },
  { id: '7', type: 'Protein', color: '#03a9f4', text: 'Kinase', frequency: 27, shown: true },
  { id: '8', type: 'Protein', color: '#03a9f4', text: 'Receptor', frequency: 18, shown: true },
];

const meta: Meta<WordCloudComponent> = {
  title: 'Shared/Word Cloud',
  component: WordCloudComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
    (story) => {
      seedRandom();
      return story();
    },
    componentWrapperDecorator(
      (story) => `<div style="height: 360px; width: 640px">${story}</div>`,
    ),
  ],
  parameters: {
    // The layout runs off requestAnimationFrame after the view initialises, and
    // the resize observer triggers further passes, so wait for it to go quiet.
    imageSnapshot: { waitFor: 'svg g text', settle: 500 },
  },
};

export default meta;

type Story = StoryObj<WordCloudComponent>;

export const Default: Story = {
  args: {
    data: terms,
  },
};

export const SingleTerm: Story = {
  args: {
    data: [terms[0]],
  },
};
