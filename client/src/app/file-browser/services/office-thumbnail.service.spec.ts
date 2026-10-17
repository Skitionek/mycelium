import { TestBed } from '@angular/core/testing';

import { Subject, Subscription } from 'rxjs';

import { MimeTypes } from 'app/shared/constants';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from './filesystem.service';
import { OfficeThumbnailService } from './office-thumbnail.service';

function file(filename: string, modifiedDate = '2026-01-01T00:00:00', mimeType = 'application/octet-stream') {
  return new FilesystemObject().update({hashId: `hash-${filename}`, filename, mimeType, modifiedDate});
}

async function until(condition: () => boolean) {
  for (let i = 0; i < 300 && !condition(); i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  expect(condition()).toBe(true);
}

/**
 * Stands in for serverless-office-converter's OfficeEngine.
 */
class FakeEngine {
  started = 0;
  stopped = 0;
  conversions: { name: string, resolve: (result: { blob: Blob }) => void, reject: (error: Error) => void }[] = [];

  async start() {
    this.started++;
  }

  stop() {
    this.stopped++;
  }

  convertFile(content: Blob, targetId: string, {name}: { name: string }) {
    return new Promise<{ blob: Blob }>((resolve, reject) => this.conversions.push({name, resolve, reject}));
  }
}

describe('OfficeThumbnailService', () => {
  let service: OfficeThumbnailService;
  let downloads: { hashId: string, content: Subject<Blob> }[];
  let engine: FakeEngine;
  let loadEngine: jasmine.Spy;
  const png = new Blob(['png'], {type: 'image/png'});

  beforeEach(() => {
    downloads = [];
    engine = new FakeEngine();
    TestBed.configureTestingModule({
      providers: [{
        provide: FilesystemService,
        useValue: {
          getContentUpTo(hashId: string) {
            const content = new Subject<Blob>();
            downloads.push({hashId, content});
            return content;
          },
        },
      }],
    });
    service = TestBed.inject(OfficeThumbnailService);
    loadEngine = spyOn(service as any, 'loadEngine').and.callFake(async () => {
      (service as any).engine = Promise.resolve(engine);
      await engine.start();
      return engine;
    });
  });

  async function finishDownload(index: number) {
    await until(() => downloads.length > index);
    downloads[index].content.next(new Blob(['office file']));
    downloads[index].content.complete();
  }

  it('shows nothing and loads nothing on a page that is not cross-origin isolated', () => {
    expect(window.crossOriginIsolated).toBeFalsy();
    expect(service.handles(file('report.docx'))).toBe(false);
    expect(loadEngine).not.toHaveBeenCalled();
  });

  describe('on a cross-origin isolated page', () => {
    let crossOriginIsolated: PropertyDescriptor;

    beforeEach(() => {
      crossOriginIsolated = Object.getOwnPropertyDescriptor(window, 'crossOriginIsolated');
      Object.defineProperty(window, 'crossOriginIsolated', {value: true, configurable: true});
    });

    afterEach(() => {
      delete (window as any).crossOriginIsolated;
      if (crossOriginIsolated) {
        Object.defineProperty(window, 'crossOriginIsolated', crossOriginIsolated);
      }
    });

    it('handles office files only, without loading anything', () => {
      expect(service.handles(file('report.docx'))).toBe(true);
      expect(service.handles(file('data.xlsx'))).toBe(true);
      expect(service.handles(file('slides.odp'))).toBe(true);
      expect(service.handles(file('paper.pdf', undefined, MimeTypes.Pdf))).toBe(false);
      expect(service.handles(file('structure.pdb'))).toBe(false);
      expect(service.handles(new FilesystemObject().update({filename: 'folder.docx', mimeType: MimeTypes.Directory})))
        .toBe(false);
      expect(service.handles(null)).toBe(false);
      expect(loadEngine).not.toHaveBeenCalled();
    });

    it('stops handling files whose thumbnail could not be rendered', async () => {
      let failed = false;
      service.thumbnail(file('broken.docx')).subscribe({error: () => failed = true});
      await finishDownload(0);
      await until(() => engine.conversions.length === 1);
      engine.conversions[0].reject(new Error('General input/output error'));
      await until(() => failed);
      expect(service.handles(file('broken.docx'))).toBe(false);
      expect(service.handles(file('report.docx'))).toBe(true);
    });

    it('stops handling files when the engine cannot run', async () => {
      loadEngine.and.callFake(async () => {
        (service as any).unavailable = true;
        return null;
      });
      let failed = false;
      service.thumbnail(file('report.docx')).subscribe({error: () => failed = true});
      await until(() => failed);
      expect(downloads.length).toBe(0);
      expect(service.handles(file('report.docx'))).toBe(false);
    });
  });

  it('downloads and converts one file at a time', async () => {
    const results: Blob[] = [];
    service.thumbnail(file('a.docx')).subscribe(thumbnail => results.push(thumbnail));
    service.thumbnail(file('b.docx')).subscribe(thumbnail => results.push(thumbnail));

    await until(() => downloads.length === 1);
    await finishDownload(0);
    await until(() => engine.conversions.length === 1);
    expect(engine.conversions[0].name).toBe('a.docx');
    expect(downloads.length).toBe(1);

    engine.conversions[0].resolve({blob: png});
    await until(() => results.length === 1);
    await finishDownload(1);
    await until(() => engine.conversions.length === 2);
    expect(engine.conversions[1].name).toBe('b.docx');
    engine.conversions[1].resolve({blob: png});
    await until(() => results.length === 2);
  });

  it('renders higher priority thumbnails first', async () => {
    service.thumbnail(file('list.docx')).subscribe();
    service.thumbnail(file('preview.docx'), 1).subscribe();
    await until(() => downloads.length === 1);
    expect(downloads[0].hashId).toBe('hash-preview.docx');
  });

  it('remembers rendered thumbnails per version of a file', async () => {
    service.thumbnail(file('report.docx')).subscribe();
    await finishDownload(0);
    await until(() => engine.conversions.length === 1);
    engine.conversions[0].resolve({blob: png});
    await until(() => service.getRendered(file('report.docx')) === png);

    let again: Blob = null;
    service.thumbnail(file('report.docx')).subscribe(thumbnail => again = thumbnail);
    expect(again).toBe(png);
    expect(downloads.length).toBe(1);
    expect(service.getRendered(file('report.docx', '2026-02-01T00:00:00'))).toBeUndefined();
  });

  it('drops thumbnails nobody waits for any more', async () => {
    const first = service.thumbnail(file('a.docx')).subscribe();
    const dropped = service.thumbnail(file('dropped.docx')).subscribe();
    service.thumbnail(file('c.docx')).subscribe();
    await until(() => downloads.length === 1);

    // Unsubscribing aborts the download in progress and the queue moves on.
    dropped.unsubscribe();
    first.unsubscribe();
    expect(downloads[0].content.observed).toBe(false);
    await until(() => downloads.length === 2);
    expect(downloads[1].hashId).toBe('hash-c.docx');
    expect(engine.conversions.length).toBe(0);
  });

  it('loads the engine only for the first thumbnail it renders, and stops it when idle', async () => {
    (service as any).engineIdleMs = 50;
    expect(loadEngine).not.toHaveBeenCalled();
    const subscription: Subscription = service.thumbnail(file('report.docx')).subscribe();
    await finishDownload(0);
    await until(() => engine.conversions.length === 1);
    expect(engine.started).toBe(1);
    expect(engine.stopped).toBe(0);
    engine.conversions[0].resolve({blob: png});
    await until(() => engine.stopped === 1);
    subscription.unsubscribe();
  });
});
