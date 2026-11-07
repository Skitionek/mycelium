import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

import { EnrichWithGOTermsResult } from 'app/enrichment/services/enrichment-visualisation.service';

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class GroupComponent {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() title;

  showMore = false;
  tabStatus;
  Infinity = Infinity;

  constructor() {
    this.tabStatus = {};
  }

  showMoreToggle() {
    this.showMore = !this.showMore;
  }
}
