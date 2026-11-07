import { Injectable } from '@angular/core';

import { from, Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { DMPDocument } from '../models/dmp.interface';

@Injectable({ providedIn: 'root' })
export class DMPService {
  constructor(private readonly filesystemService: FilesystemService) {}

  private static toBlob(document: DMPDocument): Blob {
    return new Blob([JSON.stringify(document)], { type: 'application/json' });
  }

  getDocument(hashId: string): Observable<DMPDocument> {
    return this.filesystemService.getContent(hashId).pipe(
      mergeMap((blob) => from(blob.text())),
      map((text) => JSON.parse(text) as DMPDocument),
    );
  }

  /**
   * Save new content for an existing DMP file.
   *
   * The filename is deliberately left alone: it is the user's to choose in the
   * file browser, and the maDMP title is not constrained the way a filename is.
   */
  update(hashId: string, document: DMPDocument): Observable<FilesystemObject> {
    return this.filesystemService
      .save([hashId], { contentValue: DMPService.toBlob(document) })
      .pipe(map((mapping) => mapping[hashId]));
  }
}
