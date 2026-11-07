import { Component, OnInit, Inject, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TermsOfServiceComponent {
  constructor() {
  }
}
