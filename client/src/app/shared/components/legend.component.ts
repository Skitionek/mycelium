import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-legend',
    templateUrl: './legend.component.html',
    styleUrls: ['./legend.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LegendComponent {
    @Input() legend: Map<string, string[]>;

    constructor() { }
}
