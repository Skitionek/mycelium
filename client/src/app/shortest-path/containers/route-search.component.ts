import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-route-search',
  templateUrl: './route-search.component.html',
  styleUrls: ['./route-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class RouteSearchComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
