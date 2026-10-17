import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';

import { Subscription } from 'rxjs';

import { FilesystemObject } from '../models/filesystem-object';
import { OfficeThumbnailService } from '../services/office-thumbnail.service';

/**
 * Shows the thumbnail of an office file, when office thumbnails are switched on (see
 * {@link OfficeThumbnailService}), and the projected content (e.g. a file type icon) until it
 * is rendered, for other files, or when it cannot be rendered.
 *
 * Its rendering is requested only while the element is (nearly) on screen.
 */
@Component({
  selector: 'app-object-thumbnail',
  template: `
    <img *ngIf="url; else fallback" [src]="url" alt="" class="object-thumbnail"
         [style.max-width]="width" [style.max-height]="'calc(1.25 * ' + width + ')'">
    <ng-template #fallback>
      <ng-content></ng-content>
    </ng-template>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    .object-thumbnail {
      display: block;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: #fff;
    }
  `],
})
export class ObjectThumbnailComponent implements OnChanges, OnDestroy {
  @Input() object: FilesystemObject;
  /**
   * Width of the thumbnail as a CSS length; it is up to 1.25 times as high.
   */
  @Input() width = '4rem';
  /**
   * Thumbnails with a higher priority are rendered first.
   */
  @Input() priority = 0;

  url: string = null;

  private observer: IntersectionObserver = null;
  private rendering: Subscription = null;

  constructor(protected readonly officeThumbnailService: OfficeThumbnailService,
              protected readonly elementRef: ElementRef<HTMLElement>,
              protected readonly ngZone: NgZone,
              protected readonly changeDetectorRef: ChangeDetectorRef) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('object' in changes) {
      const {previousValue: previous, currentValue: current} = changes.object;
      if (previous != null && current != null
        && previous.hashId === current.hashId && previous.modifiedDate === current.modifiedDate) {
        // The same version of the same file (e.g. the list was reloaded): carry on.
        return;
      }
      this.stop();
      this.setThumbnail(null);
      this.start(this.object);
    }
  }

  ngOnDestroy() {
    this.stop();
    if (this.url) {
      URL.revokeObjectURL(this.url);
    }
  }

  private start(object: FilesystemObject) {
    if (!this.officeThumbnailService.handles(object)) {
      return;
    }
    const rendered = this.officeThumbnailService.getRendered(object);
    if (rendered) {
      this.setThumbnail(rendered);
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(entries => {
        const visible = entries[entries.length - 1].isIntersecting;
        if (visible && this.rendering == null) {
          this.rendering = this.officeThumbnailService.thumbnail(object, this.priority).subscribe({
            next: thumbnail => {
              this.stop();
              this.ngZone.run(() => this.setThumbnail(thumbnail));
            },
            error: () => this.stop(),
          });
        } else if (!visible && this.rendering != null) {
          this.rendering.unsubscribe();
          this.rendering = null;
        }
      }, {rootMargin: '200px'});
      this.observer.observe(this.elementRef.nativeElement);
    });
  }

  private stop() {
    this.observer?.disconnect();
    this.observer = null;
    this.rendering?.unsubscribe();
    this.rendering = null;
  }

  private setThumbnail(thumbnail: Blob | null) {
    if (this.url) {
      URL.revokeObjectURL(this.url);
    }
    this.url = thumbnail ? URL.createObjectURL(thumbnail) : null;
    this.changeDetectorRef.markForCheck();
  }
}
