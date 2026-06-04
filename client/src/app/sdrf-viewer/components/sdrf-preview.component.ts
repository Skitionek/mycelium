import { Component, Input } from '@angular/core';

import { SdrfDocument } from '../models/sdrf-document';

/**
 * Lightweight inline preview of an SDRF document showing only the first few rows.
 */
@Component({
  selector: 'app-sdrf-preview',
  templateUrl: './sdrf-preview.component.html',
})
export class SdrfPreviewComponent {

  @Input() document: SdrfDocument;

  /** Maximum number of data rows shown in the preview. */
  readonly previewRowCount = 5;

}
