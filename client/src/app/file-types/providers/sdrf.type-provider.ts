import { Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ObjectCreationService } from 'app/file-browser/services/object-creation.service';
import { MimeTypes } from 'app/shared/constants';
import { RankedItem } from 'app/shared/schemas/common';
import { SearchType } from 'app/search/shared';

import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  CreateActionOptions,
  CreateDialogAction,
  Exporter,
  PreviewOptions,
} from 'app/file-types/providers/base-object.type-provider';
import { SdrfDocument } from 'app/sdrf-viewer/models/sdrf-document';

export const SDRF_MIMETYPE = MimeTypes.Sdrf;
export const SDRF_SHORTHAND = 'sdrf';

@Injectable()
export class SdrfTypeProvider extends AbstractObjectTypeProvider {

  constructor(
    abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
    protected readonly filesystemService: FilesystemService,
    protected readonly objectCreationService: ObjectCreationService,
  ) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    return (
      object.mimeType === SDRF_MIMETYPE ||
      (object.filename || '').toLowerCase().endsWith('.sdrf.tsv')
    );
  }

  createPreviewComponent(
    object: FilesystemObject,
    contentValue$: Observable<Blob>,
    options?: PreviewOptions,
  ) {
    return of(undefined);
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [{
      rank: 1,
      item: {
        label: 'SDRF File',
        openSuggested: true,
        create: (options?: CreateActionOptions): Promise<FilesystemObject> => {
          const object = new FilesystemObject();
          object.filename = '';
          object.mimeType = SDRF_MIMETYPE;
          object.parent = options?.parent;

          return this.objectCreationService.openCreateDialog(object, {
            title: 'New SDRF File',
            request: {
              contentValue: new Blob(
                [SdrfDocument.blankTemplate()],
                {type: 'text/tab-separated-values'},
              ),
              mimeType: SDRF_MIMETYPE,
            },
            ...(options?.createDialog || {}),
          });
        },
      },
    }];
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({
        id: SDRF_MIMETYPE,
        shorthand: SDRF_SHORTHAND,
        name: 'SDRF Files',
      }),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'TSV',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            const name = (object.filename || 'file')
              .replace(/\.tsv$/i, '') + '.sdrf.tsv';
            return new File([blob], name);
          }),
        );
      },
    }]);
  }
}
