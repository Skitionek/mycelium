import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { WordCloudAnnotationFilterComponent } from 'app/shared/components/word-cloud-annotation-filter/word-cloud-annotation-filter.component';
import { WordCloudAnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';
import { SortingAlgorithmId } from 'app/word-cloud/sorting/sorting-algorithms';

const frequencyAlgorithm = {
  id: SortingAlgorithmId.frequency,
  name: 'Frequency',
  valueDescription: 'Entity Frequency',
  min: 0,
  step: 1,
  default: 1,
};

const sampleAnnotations: WordCloudAnnotationFilterEntity[] = [
  {
    id: '1', type: 'Gene', color: '#3498db', text: 'MAPK1',
    keyword: 'MAPK1', primaryName: 'MAPK1', frequency: 5, shown: true,
  },
  {
    id: '2', type: 'Chemical', color: '#e74c3c', text: 'Aspirin',
    keyword: 'aspirin', primaryName: 'Aspirin', frequency: 3, shown: true,
  },
];

const meta: Meta<WordCloudAnnotationFilterComponent> = {
  title: 'Shared/Word Cloud Annotation Filter',
  component: WordCloudAnnotationFilterComponent,
  decorators: [
    moduleMetadata({
      // The template mixes reactive forms with a [(ngModel)] grouping select.
      imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<WordCloudAnnotationFilterComponent>;

export const WithAnnotations: Story = {
  args: {
    annotationData: sampleAnnotations,
    sortingAlgorithm: frequencyAlgorithm,
    clickableWords: false,
  },
};

export const ClickableWords: Story = {
  args: {
    annotationData: sampleAnnotations,
    sortingAlgorithm: frequencyAlgorithm,
    clickableWords: true,
  },
};
