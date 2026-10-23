import {
  Directive,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  AfterContentChecked,
  HostListener
} from '@angular/core';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

import { createResizeObservable } from '../rxjs/resize-observable';

/**
 * Show tooltip only if text is truncated (overflows its container).
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '.text-truncate'
})
// @ts-ignore
export class TextTruncateDirective extends NgbTooltip implements OnInit, OnDestroy, AfterContentChecked {
  private readonly _ownElementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    super();
    this.resizeSubscription = createResizeObservable(this._ownElementRef.nativeElement).subscribe(() => {
      this.resized = true;
      this.onResize();
    });
    this.onResize();
  }

  private resized;

  resizeSubscription: Subscription;
  container = 'body';

  @Input() set title(title) {
    this.ngbTooltip = title;
  }

  @Input() set titlePlacement(placement) {
    this.placement = placement;
  }

  @Input() set titleContainer(container) {
    this.container = container;
  }

  ngOnInit() {
    super.ngOnInit();
  }

  onResize() {
    const {scrollWidth, offsetWidth} = this._ownElementRef.nativeElement;
    this.disableTooltip = scrollWidth <= offsetWidth;
  }

  ngAfterContentChecked() {
    this.ngbTooltip = super.ngbTooltip || (this._ownElementRef && this._ownElementRef.nativeElement.innerText) || undefined;
  }

  ngOnDestroy() {
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
    super.ngOnDestroy();
  }

  @HostListener('window:scroll')
  @HostListener('scroll')
  onScroll() {
    this.close();
  }
}
