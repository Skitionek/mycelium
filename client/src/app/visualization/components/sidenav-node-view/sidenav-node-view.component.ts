import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

import { SidenavNodeEntity } from 'app/interfaces';

@Component({
    selector: 'app-sidenav-node-view',
    templateUrl: './sidenav-node-view.component.html',
    styleUrls: ['./sidenav-node-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SidenavNodeViewComponent {
    @Input() legend: Map<string, string[]>;
    @Input() nodeEntity: SidenavNodeEntity;

    constructor() { }
}
