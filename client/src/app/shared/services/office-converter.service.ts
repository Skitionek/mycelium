import { Injectable, NgZone } from '@angular/core';

import { Observable } from 'rxjs';

/** Where angular.json serves the serverless-office-converter package. */
const ENGINE_BASE = 'assets/vendor/office-converter/';

/** The part of serverless-office-converter's `OfficeEngine` used here. */
interface OfficeEngine {
  convertFile(file: Blob, targetId: string, options?: { name?: string, priority?: number }):
    Promise<{ blob: Blob }>;
}

/**
 * Converts office documents to PDF in the browser, with LibreOffice compiled to WebAssembly
 * (https://github.com/Skitionek/serverless-office-converter), so that previewing a document
 * does not need the server to convert it.
 *
 * The engine (about 30 MB, cached by the browser after the first use) is loaded on the first
 * conversion and runs in a Web Worker. It needs SharedArrayBuffer, so it only works on a
 * cross-origin isolated page (see nginx.conf); check {@link available} before using it.
 */
@Injectable({providedIn: 'root'})
export class OfficeConverterService {
  private engine: Promise<OfficeEngine> | null = null;
  private engineMissing = false;

  constructor(protected readonly ngZone: NgZone) {
  }

  /**
   * Whether documents can be converted in this browser. When the engine files turn out
   * to be missing, conversions fail and this becomes false.
   */
  get available(): boolean {
    return window.crossOriginIsolated === true && !this.engineMissing;
  }

  toPdf(file: Blob, filename: string): Observable<Blob> {
    return new Observable<Blob>(subscriber => {
      this.ngZone.runOutsideAngular(() => {
        this.getEngine()
          .then(engine => engine.convertFile(file, 'pdf', {name: filename, priority: 1}))
          .then(
            ({blob}) => this.ngZone.run(() => {
              subscriber.next(blob);
              subscriber.complete();
            }),
            error => this.ngZone.run(() => subscriber.error(error)),
          );
      });
    });
  }

  private getEngine(): Promise<OfficeEngine> {
    if (this.engine == null) {
      const base = new URL(ENGINE_BASE, document.baseURI).href;
      this.engine = import(/* webpackIgnore: true */ base + 'office-engine.js').then(
        module => new module.OfficeEngine({base}) as OfficeEngine,
        error => {
          // Not installed: stop trying, the server converts instead
          this.engineMissing = true;
          throw error;
        },
      );
    }
    return this.engine;
  }
}
