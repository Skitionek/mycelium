import { ComponentFactoryResolver, ComponentRef, Injectable, Injector } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { OfficeThumbnailService } from 'app/file-browser/services/office-thumbnail.service';
import { ObjectThumbnailComponent } from 'app/file-browser/components/object-thumbnail.component';

import { AbstractObjectTypeProvider, AbstractObjectTypeProviderHelper, Exporter, PreviewOptions } from './base-object.type-provider';

/**
 * A generic file type provider that is returned when we don't know what type of object
 * it is or we don't support it.
 */
@Injectable()
export class DefaultObjectTypeProvider extends AbstractObjectTypeProvider {
  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService,
              protected readonly officeThumbnailService: OfficeThumbnailService,
              protected readonly injector: Injector,
              protected readonly componentFactoryResolver: ComponentFactoryResolver) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    return true;
  }

  /**
   * Office files are previewed with a large thumbnail, when office thumbnails are switched on.
   */
  createPreviewComponent(object: FilesystemObject, contentValue$: Observable<Blob>,
                         options?: PreviewOptions): Observable<ComponentRef<any> | undefined> {
    if (!this.officeThumbnailService.handles(object)) {
      return of(null);
    }
    const componentRef = this.componentFactoryResolver.resolveComponentFactory(ObjectThumbnailComponent)
      .create(this.injector);
    componentRef.location.nativeElement.classList.add('d-flex', 'justify-content-center', 'p-4');
    componentRef.setInput('width', '12rem');
    // The file the user is looking at goes before the thumbnails of file lists.
    componentRef.setInput('priority', 1);
    componentRef.setInput('object', object);
    return of(componentRef);
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'Download',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename);
          }),
        );
      },
    }]);
  }
}
