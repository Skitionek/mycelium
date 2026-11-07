import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-legend',
    templateUrl: './legend.component.html',
    styleUrls: ['./legend.component.scss'],
    standalone: false
})
export class LegendComponent {
    @Input() legend: Map<string, string[]>;

    constructor() { }
}
