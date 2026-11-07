import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';

import { SankeyDetailsPanelComponent } from 'app/sankey-viewer/components/details-panel/details-panel.component';

import { SankeyManyToManySelection } from '../interfaces';

@Component({
  selector: 'app-sankey-many-to-many-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SankeyManyToManyDetailsPanelComponent extends SankeyDetailsPanelComponent {
  // @ts-ignore
  @Input() details: Array<SankeyManyToManySelection>;
}
