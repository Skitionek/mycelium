import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-form-row',
  templateUrl: './form-row.component.html',
  standalone: false,
})
export class FormRowComponent {
  @Input() for: string | undefined;
  @Input() label: string | undefined;
  @Input() control: AbstractControl;
  @Input() errors: {};
}
