import {Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';

import {PDFResult} from 'app/interfaces';

@Component({
  selector: 'app-file-records',
  templateUrl: './file-records.component.html',
  styleUrls: ['./file-records.component.scss'],
  styles: ['.highlight {border: 2px solid red}'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class FileRecordsComponent implements OnInit {

  @Input() results: PDFResult;

  constructor() {
  }

  ngOnInit() {
  }

}
