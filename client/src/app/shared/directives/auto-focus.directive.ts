import { AfterViewInit, Directive, ElementRef, Input } from '@angular/core';

/**
 * Auto-focus the given element on load.
 */
@Directive({
  selector: '[appAutoFocus]',
  standalone: false,
})
export class AutoFocusDirective implements AfterViewInit {
  @Input() autoSelect = false;
  @Input() setFocus = true;

  constructor(private readonly element: ElementRef) {
  }

  ngAfterViewInit() {
    if (!this.setFocus) {
      return;
    }
    this.element.nativeElement.focus();
    if (this.autoSelect) {
      this.element.nativeElement.select();
    }
  }
}
