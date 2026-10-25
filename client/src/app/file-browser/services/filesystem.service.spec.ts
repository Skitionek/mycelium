import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { ApiService } from 'app/shared/services/api.service';

import { FilesystemService, LockError } from './filesystem.service';

const LOCKS_URL = '/api/filesystem/objects/hash%2Fid/locks';

describe('FilesystemService locks', () => {
  let service: FilesystemService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [HttpClientTestingModule]});
    http = TestBed.inject(HttpTestingController);
    const auth = {getAccessToken: () => 'token'} as AuthenticationService;
    const client = TestBed.inject(HttpClient);
    service = new FilesystemService(
      null, null, null, null, null, null,
      client, new ApiService(auth, client),
      null, null, null,
    );
    // The constructor asks for the LMDB dates; nothing here depends on them.
    http.expectOne('/api/files/lmdbs_dates').flush({});
  });

  afterEach(() => http.verify());

  // The endpoints read `own` from the JSON body; as a query parameter it was
  // ignored, and the request was rejected.
  it('should acquire a lock with own in the body', () => {
    let locks;
    service.acquireLock('hash/id').subscribe(result => locks = result);

    const request = http.expectOne(LOCKS_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({own: true});
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush({results: [{acquireDate: '2026-01-01'}]});

    expect(locks.length).toBe(1);
  });

  it('should report the locks of others when the file is taken', () => {
    let error;
    service.acquireLock('hash/id').subscribe({error: e => error = e});

    http.expectOne(LOCKS_URL).flush(
      {results: [{acquireDate: '2026-01-01'}]},
      {status: 409, statusText: 'Conflict'},
    );

    expect(error).toEqual(jasmine.any(LockError));
    expect(error.locks.length).toBe(1);
  });

  it('should release a lock with own in a JSON body', () => {
    service.deleteLock('hash/id').subscribe();

    const request = http.expectOne(LOCKS_URL);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({own: true});
    expect(request.request.headers.get('Content-Type')).toBe('application/json');
    request.flush(null);
  });
});
