import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-modal-header',
  templateUrl: './modal-header.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ModalHeaderComponent {
  @Output() cancel = new EventEmitter<any>();
}
