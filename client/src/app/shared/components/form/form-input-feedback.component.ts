import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl } from '@angular/forms';

import { getTopParent } from '../../utils/forms';

@Component({
  selector: 'app-form-input-feedback',
  templateUrl: './form-input-feedback.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FormInputFeedbackComponent {
  @Input() control: AbstractControl | undefined;
  @Input() errors = {};
  /**
   * Indicates whether this component is being used for the form itself.
   */
  @Input() formLevel = false;

  get dirty() {
    return this.control != null && (this.control.dirty || getTopParent(this.control).dirty);
  }
}
