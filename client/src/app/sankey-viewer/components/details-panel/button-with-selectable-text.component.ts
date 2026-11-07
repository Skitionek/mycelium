import { Component, Input, ChangeDetectionStrategy, } from '@angular/core';

import { SankeyDetailsComponent } from './details.component';

@Component({
  selector: 'app-button-with-selectable-text',
  templateUrl: './button-with-selectable-text.component.html',
  styleUrls: ['./button-with-selectable-text.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
// @ts-ignore
export class ButtonWithSelectableTextComponent extends SankeyDetailsComponent {
  @Input() disabled;
}
