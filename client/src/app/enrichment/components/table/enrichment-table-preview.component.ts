import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

import { EnrichmentDocument } from '../../models/enrichment-document';

@Component({
  selector: 'app-enrichment-table-preview',
  templateUrl: './enrichment-table-preview.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EnrichmentTablePreviewComponent {

  @Input() document: EnrichmentDocument;

}
