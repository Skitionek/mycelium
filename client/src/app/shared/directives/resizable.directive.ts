import { Directive, ElementRef, Input, OnInit } from '@angular/core';

import { isNil } from 'lodash-es';


@Directive({
  selector: '[appResizable]',
  standalone: false
})
export class ResizableDirective  implements OnInit {
  // Note: the CSS `resize` property does not support directional handles.
  // The `handles` input is retained for API compatibility but has no effect.
  @Input() handles = 'n,w,s,e';
  @Input() minHeight = 52;

  el: ElementRef;

  constructor(el: ElementRef) {
    this.el = el;
  }

  ngOnInit() {
    if (isNil(
      this.el.nativeElement
    )) {
      return;
    }

    const element: HTMLElement = this.el.nativeElement;
    element.style.resize = 'both';
    element.style.overflow = 'auto';
    element.style.maxWidth = '500px';
    element.style.minWidth = '256px';
    element.style.maxHeight = '500px';
    element.style.minHeight = `${this.minHeight}px`;
  }
}
