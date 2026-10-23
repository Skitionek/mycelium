import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ApiService } from 'app/shared/services/api.service';

import { LOCAL_ROOT_STORE, LocalRootStore, MemoryLocalRootStore } from '../local-root-store';

/**
 * Configure TestBed for the local folder services, backed by in-memory storage.
 */
export function configureLocalFolderTestBed(store: LocalRootStore = new MemoryLocalRootStore()) {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [
      {provide: LOCAL_ROOT_STORE, useValue: store},
      {provide: ApiService, useValue: {getHttpOptions: () => ({})}},
    ],
  });
  return store;
}

/**
 * Wait for a condition that is reached asynchronously.
 */
export async function waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
