import { Component, ChangeDetectionStrategy } from '@angular/core';

import { SankeyDetailsComponent } from './details.component';

@Component({
  selector: 'app-sankey-trace-details',
  templateUrl: './trace-details.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SankeyTraceDetailsComponent extends SankeyDetailsComponent {
}
