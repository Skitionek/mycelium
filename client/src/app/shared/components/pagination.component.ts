import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

import { PaginatedRequestOptions } from '../schemas/common';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PaginationComponent<T extends PaginatedRequestOptions = PaginatedRequestOptions> {

  @Input() paging: T | undefined;
  @Input() collectionSize = 0;
  @Input() alwaysShow = false;
  @Output() pageChange = new EventEmitter<T>();

  goToPage(page: number) {
    this.pageChange.next({
      ...this.paging,
      page,
    });
  }
}
