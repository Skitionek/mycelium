import { Injectable } from '@angular/core';

import { map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ObjectCreationService } from 'app/file-browser/services/object-creation.service';
import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  CreateActionOptions,
  CreateDialogAction,
  Exporter,
} from 'app/file-types/providers/base-object.type-provider';
import { blankDMPDocument } from 'app/dmp/models/dmp-template';
import { SearchType } from 'app/search/shared';
import { RankedItem } from 'app/shared/schemas/common';
import { MimeTypes } from 'app/shared/constants';


@Injectable()
export class DmpTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService,
              protected readonly objectCreationService: ObjectCreationService) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.Dmp;
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [{
      rank: 1,
      item: {
        label: 'Data Management Plan',
        openSuggested: true,
        create: (options?: CreateActionOptions): Promise<FilesystemObject> => {
          const object = new FilesystemObject();
          object.filename = '';
          object.mimeType = MimeTypes.Dmp;
          object.parent = options?.parent;

          return this.objectCreationService.openCreateDialog(object, {
            title: 'New Data Management Plan',
            request: {
              contentValue: new Blob(
                [JSON.stringify(blankDMPDocument('Untitled Data Management Plan'))],
                {type: 'application/json'},
              ),
              mimeType: MimeTypes.Dmp,
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
        id: MimeTypes.Dmp,
        shorthand: 'dmp',
        name: 'Data Management Plans',
      }),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'Mycelium DMP File',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map((blob) => new File([blob], object.filename + '.dmp.json')),
        );
      },
    }]);
  }

}
