import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { ResultList } from 'app/shared/schemas/common';

import { DMPDocument, DMPRecord } from '../models/dmp.interface';

@Injectable({ providedIn: 'root' })
export class DMPService {
  readonly dmpApi = '/api/dmp';

  constructor(private http: HttpClient) {}

  list(): Observable<ResultList<DMPRecord>> {
    return this.http.get<ResultList<DMPRecord>>(`${this.dmpApi}`);
  }

  get(hashId: string): Observable<DMPRecord> {
    return this.http.get<DMPRecord>(`${this.dmpApi}/${hashId}`);
  }

  create(document: DMPDocument): Observable<DMPRecord> {
    return this.http.post<DMPRecord>(`${this.dmpApi}`, document);
  }

  update(hashId: string, document: DMPDocument): Observable<DMPRecord> {
    return this.http.put<DMPRecord>(`${this.dmpApi}/${hashId}`, document);
  }

  delete(hashId: string): Observable<void> {
    return this.http.delete<void>(`${this.dmpApi}/${hashId}`);
  }
}
