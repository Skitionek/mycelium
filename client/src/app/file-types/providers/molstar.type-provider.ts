import {
  Injectable,
} from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  Exporter,
} from 'app/file-types/providers/base-object.type-provider';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { PROTEIN_STRUCTURE_MIME_TYPES } from 'app/shared/constants';

@Injectable()
export class MolstarTypeProvider extends AbstractObjectTypeProvider {

  constructor(
    abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
    protected readonly filesystemService: FilesystemService,
  ) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    const filename = (object?.filename || '').toLowerCase();
    return PROTEIN_STRUCTURE_MIME_TYPES.has(object.mimeType)
      || filename.endsWith('.pdb')
      || filename.endsWith('.cif')
      || filename.endsWith('.mmcif')
      || object.mimeType === 'chemical/x-mmcif';
  }

  createPreviewComponent(object: FilesystemObject, contentValue$: Observable<Blob>) {
    return of(undefined);
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'Download',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => new File([blob], object.filename)),
        );
      },
    }]);
  }

}
