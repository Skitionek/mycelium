import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { FormInputFeedbackComponent } from 'app/shared/components/form/form-input-feedback.component';
import { FormRowComponent } from 'app/shared/components/form/form-row.component';

function dirtyControl(value: string, validators: Validators[]): FormControl {
  const control = new FormControl(value, validators as never);
  control.markAsDirty();
  return control;
}

const meta: Meta<FormRowComponent> = {
  title: 'Shared/Form/Form Row',
  component: FormRowComponent,
  decorators: [
    moduleMetadata({
      declarations: [FormInputFeedbackComponent],
      imports: [CommonModule, ReactiveFormsModule],
    }),
    componentWrapperDecorator((story) => `<div style="width: 640px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<FormRowComponent>;

export const WithLabel: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-form-row [for]="for" [label]="label" [control]="control" [errors]="errors">
        <input id="filename" type="text" class="form-control" value="results.pdf">
      </app-form-row>`,
  }),
  args: {
    for: 'filename',
    label: 'Filename',
    control: undefined,
    errors: {},
  },
};

/** Without a label the row drops the grid columns and fills the width. */
export const WithoutLabel: Story = {
  ...WithLabel,
  args: {
    ...WithLabel.args,
    label: undefined,
  },
};

export const WithValidationError: Story = {
  ...WithLabel,
  args: {
    ...WithLabel.args,
    control: dirtyControl('', [Validators.required]),
  },
};
