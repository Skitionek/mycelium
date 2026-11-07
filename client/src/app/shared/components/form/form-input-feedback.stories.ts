import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { FormInputFeedbackComponent } from 'app/shared/components/form/form-input-feedback.component';

/**
 * Feedback only shows once the control is dirty, so every fixture marks it so.
 */
function dirtyControl(value: string, validators: Validators[]): FormControl {
  const control = new FormControl(value, validators as never);
  control.markAsDirty();
  return control;
}

const meta: Meta<FormInputFeedbackComponent> = {
  title: 'Shared/Form/Form Input Feedback',
  component: FormInputFeedbackComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<FormInputFeedbackComponent>;

export const Required: Story = {
  args: {
    control: dirtyControl('', [Validators.required]),
    errors: {},
    formLevel: false,
  },
};

export const MinLength: Story = {
  args: {
    control: dirtyControl('ab', [Validators.minLength(8)]),
    errors: {},
    formLevel: false,
  },
};

export const InvalidEmail: Story = {
  args: {
    control: dirtyControl('not-an-email', [Validators.email]),
    errors: {},
    formLevel: false,
  },
};

/** `formLevel` switches the styling from inline feedback to a danger alert. */
export const FormLevel: Story = {
  args: {
    control: dirtyControl('', [Validators.required]),
    errors: {},
    formLevel: true,
  },
};

/** A valid control renders nothing. */
export const Valid: Story = {
  args: {
    control: dirtyControl('ada@example.org', [Validators.required, Validators.email]),
    errors: {},
    formLevel: false,
  },
};
