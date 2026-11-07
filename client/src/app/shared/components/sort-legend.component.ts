import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-sort-legend',
  templateUrl: './sort-legend.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SortLegendComponent {
  @Input() order: number | undefined;
  @Input() type: 'alpha' | 'numeric' | 'amount' = 'amount';
}
