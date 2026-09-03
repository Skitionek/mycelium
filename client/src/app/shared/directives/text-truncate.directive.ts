import {
  Directive,
  ElementRef,
  Renderer2,
  Input,
  Inject,
  Injectable,
  Injector,
  ViewContainerRef,
  NgZone,
  ChangeDetectorRef,
  ApplicationRef,
  OnDestroy,
  OnInit,
  AfterContentChecked,
  HostListener
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { NgbTooltip, NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

import { createResizeObservable } from '../rxjs/resize-observable';

/**
 * Local re-implementation of NgbRTL whose internal path is no longer accessible
 * through @ng-bootstrap/ng-bootstrap v13's package exports field.
 */
@Injectable({ providedIn: 'root' })
class NgbRTLCompat {
  private readonly _element: HTMLElement;
  constructor(@Inject(DOCUMENT) document: Document) {
    this._element = document.documentElement;
  }
  isRTL(): boolean {
    return (this._element.getAttribute('dir') || '').toLowerCase() === 'rtl';
  }
}

/**
 * Show tooltip only if text is truncated (overflows its container).
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '.text-truncate'
})
// @ts-ignore
export class TextTruncateDirective extends NgbTooltip implements OnInit, OnDestroy, AfterContentChecked {
  constructor(
    protected _elementRef: ElementRef<HTMLElement>,
    protected _renderer: Renderer2,
    protected injector: Injector,
    protected viewContainerRef: ViewContainerRef,
    protected config: NgbTooltipConfig,
    protected _ngZone: NgZone,
    @Inject(DOCUMENT) protected _document: Document,
    protected _changeDetector: ChangeDetectorRef,
    protected applicationRef: ApplicationRef
  ) {
    super(
      _elementRef,
      _renderer,
      injector,
      viewContainerRef,
      config,
      _ngZone,
      _document,
      _changeDetector,
      applicationRef
    );
    this.resizeSubscription = createResizeObservable(this._elementRef.nativeElement).subscribe(() => {
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
    const {scrollWidth, offsetWidth} = this._elementRef.nativeElement;
    this.disableTooltip = scrollWidth <= offsetWidth;
  }

  ngAfterContentChecked() {
    this.ngbTooltip = super.ngbTooltip || (this._elementRef && this._elementRef.nativeElement.innerText) || undefined;
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
