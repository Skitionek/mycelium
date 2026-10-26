import { createNgModule, Injector, RendererFactory2, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AppModule } from 'app/app.module';
import { BiocViewerLibModule } from 'app/bioc-viewer/bioc-viewer-lib.module';
import { CodemirrorViewerLibModule } from 'app/codemirror-viewer/codemirror-viewer-lib.module';
import { MolstarViewerLibModule } from 'app/molstar-viewer/molstar-viewer-lib.module';
import { PdfViewerLibModule } from 'app/pdf-viewer/pdf-viewer-lib.module';
import { SankeyManyToManyViewerLibModule } from 'app/sankey-many-to-many-viewer/sankey-viewer-lib.module';
import { SankeyViewerLibModule } from 'app/sankey-viewer/sankey-viewer-lib.module';
import { TraceViewerLibModule } from 'app/trace-viewer/trace-viewer-lib.module';

const lazyLoadedViewerModules: Type<unknown>[] = [
  BiocViewerLibModule,
  CodemirrorViewerLibModule,
  MolstarViewerLibModule,
  PdfViewerLibModule,
  SankeyViewerLibModule,
  SankeyManyToManyViewerLibModule,
  TraceViewerLibModule,
];

describe('Lazy-loaded viewer modules', () => {
  beforeEach(() => {
    // Given the application root, which provides animations and the router once
    TestBed.configureTestingModule({imports: [AppModule]});
  });

  lazyLoadedViewerModules.forEach(viewerModule => {
    it(`${viewerModule.name} should render through the root animation engine`, () => {
      const rootRendererFactory = TestBed.inject(RendererFactory2);

      // When the viewer module is loaded lazily under the root
      const moduleRef = createNgModule(viewerModule, TestBed.inject(Injector));

      // Then it renders through the root renderer, whose engine flushes removed elements;
      // a module-level engine is never flushed, so removed elements stay on screen
      expect(moduleRef.injector.get(RendererFactory2)).toBe(rootRendererFactory);
    });

    it(`${viewerModule.name} should navigate with the root router`, () => {
      const rootRouter = TestBed.inject(Router);

      // When the viewer module is loaded lazily under the root
      const moduleRef = createNgModule(viewerModule, TestBed.inject(Injector));

      // Then its components get the root router, which knows the application routes
      expect(moduleRef.injector.get(Router)).toBe(rootRouter);
    });
  });
});
