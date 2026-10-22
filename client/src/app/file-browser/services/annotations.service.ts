import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { defer, Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiService } from 'app/shared/services/api.service';
import { isLocalHashId } from 'app/local-filesystem/local-ids';
import { unsupportedError } from 'app/local-filesystem/local-folder-errors';
import { LocalIndexerService } from 'app/local-filesystem/services/local-indexer.service';
import { ResultList, ResultMapping } from 'app/shared/schemas/common';
import { Annotation } from 'app/pdf-viewer/annotation-type';
import {
  SortingAlgorithmId
} from 'app/word-cloud/sorting/sorting-algorithms';

import {
  AnnotationExclusionCreateRequest,
  AnnotationExclusionDeleteRequest,
  PDFAnnotationGenerationRequest,
  AnnotationGenerationResultData,
  CustomAnnotationCreateRequest,
  CustomAnnotationDeleteRequest,
} from '../schema';

@Injectable()
export class AnnotationsService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService,
              protected readonly localIndexer: LocalIndexerService) {
  }

  getAnnotations(hashId: string): Observable<Annotation[]> {
    if (isLocalHashId(hashId)) {
      // Found by the local indexer and kept in the folder's index
      return defer(() => this.localIndexer.getAnnotations(hashId));
    }
    return this.http.get<ResultList<Annotation>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => data.results),
    );
  }

  getSortedAnnotations(hashId: string, sort: SortingAlgorithmId) {
    if (isLocalHashId(hashId)) {
      return this.localUnsupported();
    }
    return this.http.post(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/sorted`, {}, {
        ...this.apiService.getHttpOptions(true),
        params: {sort},
        responseType: 'text',
      },
    );
  }

  generateAnnotations(hashIds: string[], request: PDFAnnotationGenerationRequest = {}):
    Observable<ResultMapping<AnnotationGenerationResultData>> {
    if (hashIds.some(hashId => isLocalHashId(hashId))) {
      return throwError(() => unsupportedError(
        'Files in local folders are annotated automatically by the local indexer. Use "Rebuild index" '
        + 'on the folder to annotate them again.'));
    }
    return this.http.post<ResultMapping<AnnotationGenerationResultData>>(
      `/api/filesystem/annotations/generate`, {
        hashIds,
        ...request,
      },
      this.apiService.getHttpOptions(true),
    );
  }

  addCustomAnnotation(hashId: string, request: CustomAnnotationCreateRequest): Observable<Annotation[]> {
    if (isLocalHashId(hashId)) {
      return this.localUnsupported();
    }
    return this.http.post<ResultList<Annotation>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/custom`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => data.results),
    );
  }

  removeCustomAnnotation(hashId: string, uuid: string, request: CustomAnnotationDeleteRequest): Observable<string[]> {
    if (isLocalHashId(hashId)) {
      return this.localUnsupported();
    }
    return this.http.request<ResultList<string>>(
      'DELETE',
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/custom/${encodeURIComponent(uuid)}`, {
        ...this.apiService.getHttpOptions(true, {
          contentType: 'application/json',
        }),
        body: request,
        responseType: 'json',
      },
    ).pipe(
      map(data => data.results),
    );
  }

  addAnnotationExclusion(hashId: string, request: AnnotationExclusionCreateRequest): Observable<{}> {
    if (isLocalHashId(hashId)) {
      return this.localUnsupported();
    }
    return this.http.post<{}>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/exclusions`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(() => ({}))
    );
  }

  removeAnnotationExclusion(hashId: string, request: AnnotationExclusionDeleteRequest): Observable<{}> {
    if (isLocalHashId(hashId)) {
      return this.localUnsupported();
    }
    return this.http.request<{}>(
      'DELETE',
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/exclusions`, {
        ...this.apiService.getHttpOptions(true, {
          contentType: 'application/json',
        }),
        body: request,
        responseType: 'json',
      },
    ).pipe(
      map(() => ({}))
    );
  }

  private localUnsupported(): Observable<never> {
    return throwError(() => unsupportedError(
      'Custom annotations, exclusions and annotation statistics are kept on the server. Upload the '
      + 'file to a project to curate its annotations.'));
  }

}
