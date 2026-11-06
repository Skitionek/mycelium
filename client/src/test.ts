/* eslint-disable import-x/order */
// https://github.com/start-angular/SB-Admin-BS4-Angular-8/issues/139
// This file is required by karma.conf.js and loads recursively all the .spec and framework files

// Polyfill Promise.withResolvers (used by pdfjs-dist v6, not available in all test environments)
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

import 'zone.js/testing';

import { NgModule, provideZoneChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// Angular 21 runs TestBed zoneless (with automatic change detection) unless told otherwise. The
// application keeps zone.js (see main.ts), so the specs run the same way.
@NgModule({providers: [provideZoneChangeDetection()]})
class ZoneChangeDetectionTestingModule {}

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  [BrowserDynamicTestingModule, ZoneChangeDetectionTestingModule],
  platformBrowserDynamicTesting()
);
