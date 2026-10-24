import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { AnnotationConfigurationTableComponent } from 'app/shared/components/table/annotation-config-table.component';

function buildForm(models: string[]): FormGroup {
  const methodsGroup: Record<string, FormGroup> = {};
  for (const model of models) {
    methodsGroup[model] = new FormGroup({
      nlp: new FormControl(model === 'Gene'),
      rulesBased: new FormControl(model !== 'Gene'),
    });
  }
  return new FormGroup({
    excludeReferences: new FormControl(false),
    annotationMethods: new FormGroup(methodsGroup),
  });
}

const models = ['Gene', 'Chemical', 'Disease'];

const meta: Meta<AnnotationConfigurationTableComponent> = {
  title: 'Shared/Annotation Config Table',
  component: AnnotationConfigurationTableComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<AnnotationConfigurationTableComponent>;

export const Default: Story = {
  args: {
    headers: ['NLP', 'Rules Based'],
    models,
    form: buildForm(models),
    fileType: 'vnd.mycelium.document/pdf',
  },
};

export const EnrichmentTable: Story = {
  args: {
    headers: ['NLP', 'Rules Based'],
    models,
    form: buildForm(models),
    fileType: 'vnd.mycelium.document/enrichment-table',
  },
};
