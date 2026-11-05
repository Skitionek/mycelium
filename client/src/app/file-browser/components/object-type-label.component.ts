import { Component, Input } from '@angular/core';

import { FilesystemObject } from '../models/filesystem-object';

@Component({
  selector: 'app-file-type-label',
  templateUrl: './object-type-label.component.html',
  standalone: false,
})
export class ObjectTypeLabelComponent {
  @Input() object: FilesystemObject;
  @Input() showLabel = true;
}
