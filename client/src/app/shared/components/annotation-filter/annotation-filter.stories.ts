import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { AnnotationFilterComponent } from 'app/shared/components/annotation-filter/annotation-filter.component';
import { AnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';
import { SortingAlgorithmId } from 'app/word-cloud/sorting/sorting-algorithms';

const frequencyAlgorithm = {
  id: SortingAlgorithmId.frequency,
  name: 'Frequency',
  valueDescription: 'Entity Frequency',
  min: 0,
  step: 1,
  default: 1,
};

const sampleAnnotations: AnnotationFilterEntity[] = [
  { id: '1', type: 'Gene', color: '#3498db', text: 'MAPK1', keyword: 'MAPK1', primaryName: 'MAPK1', frequency: 5 },
  { id: '2', type: 'Gene', color: '#3498db', text: 'TP53', keyword: 'TP53', primaryName: 'TP53', frequency: 3 },
  { id: '3', type: 'Chemical', color: '#e74c3c', text: 'Aspirin', keyword: 'aspirin', primaryName: 'Aspirin', frequency: 2 },
  { id: '4', type: 'Disease', color: '#2ecc71', text: 'Cancer', keyword: 'cancer', primaryName: 'Cancer', frequency: 8 },
];

const meta: Meta<AnnotationFilterComponent<AnnotationFilterEntity>> = {
  title: 'Shared/Annotation Filter',
  component: AnnotationFilterComponent,
  decorators: [
    moduleMetadata({
      // The template mixes reactive forms with a [(ngModel)] grouping select.
      imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<AnnotationFilterComponent<AnnotationFilterEntity>>;

export const WithAnnotations: Story = {
  args: {
    annotationData: sampleAnnotations,
    sortingAlgorithm: frequencyAlgorithm,
  },
};

export const Empty: Story = {
  args: {
    annotationData: [],
    sortingAlgorithm: frequencyAlgorithm,
  },
};
