import { Component, Input, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-bioc-infons',
  templateUrl: './infons.component.html',
  styleUrls: ['./infons.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class InfonsComponent {
  @Input() data;
}
