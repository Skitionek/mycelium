import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-sankey-view-confirm',
  template: `
  <div class="modal-header">
    <h4 class="modal-title" id="modal-title">{{ header }}</h4>
    <button type="button" class="btn-close" aria-label="Close button" aria-describedby="modal-title" (click)="modal.dismiss()"></button>
  </div>
  <div class="modal-body">
    {{ body }}
  </div>
  <div class="modal-footer">
    <button type="button" class="btn btn-secondary" (click)="modal.dismiss()">Cancel</button>
    <button type="button" ngbAutofocus class="btn btn-danger ms-2" (click)="modal.close()">Ok</button>
  </div>
  `
})
export class SankeyViewConfirmComponent {
  constructor(public modal: NgbActiveModal) {}

  @Input() header;
  @Input() body;
}
