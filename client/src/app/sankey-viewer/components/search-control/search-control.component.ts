import { Component, ChangeDetectionStrategy } from '@angular/core';

import { SankeySearchService } from '../../services/search.service';

@Component({
  selector: 'app-sankey-search-control',
  templateUrl: './search-control.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SankeySearchControlComponent {
  constructor(
    public search: SankeySearchService
  ) {
  }
}
