import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { BaseControlComponent } from 'app/shared/components/base-control.component';
import { ResultControlComponent } from 'app/shared/components/result-control.component';

const meta: Meta<ResultControlComponent> = {
  title: 'Shared/Result Control',
  component: ResultControlComponent,
  decorators: [
    moduleMetadata({
      declarations: [BaseControlComponent],
      imports: [CommonModule, NgbModule],
    }),
    componentWrapperDecorator((story) => `<div style="width: 460px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<ResultControlComponent>;

/** Without an annotation colour the term renders as a grey pill. */
export const Default: Story = {
  args: {
    value: 'kinase',
    disabled: false,
    resultIndex: 2,
    resultCount: 17,
    annotationColor: null,
  },
};

/** An annotation colour replaces the pill with a tinted highlight. */
export const AnnotationColor: Story = {
  args: {
    value: 'kinase',
    disabled: false,
    resultIndex: 2,
    resultCount: 17,
    annotationColor: '#673ab7',
  },
};

export const NoResults: Story = {
  args: {
    value: 'kinase',
    disabled: false,
    resultIndex: 0,
    resultCount: 0,
    annotationColor: null,
  },
};
