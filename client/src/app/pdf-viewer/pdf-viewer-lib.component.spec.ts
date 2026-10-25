import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';

import { PdfViewerLibComponent } from './pdf-viewer-lib.component';
import { PdfViewerLibModule } from './pdf-viewer-lib.module';

describe('PdfViewerLibComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        BrowserAnimationsModule,
        PdfViewerLibModule,
        SharedModule,
        MatSnackBarModule,
        RootStoreModule,
      ]
    }).compileComponents();
  }));
  it('should create the app', async(() => {
    const fixture = TestBed.createComponent(PdfViewerLibComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  }));
  it('should build annotation popovers whose sections Bootstrap 5 can expand', () => {
    const component: PdfViewerLibComponent = TestBed.createComponent(PdfViewerLibComponent).componentInstance;
    const content = document.createElement('div');
    content.innerHTML = component.prepareTooltipContent({
      pageNumber: 1,
      keywords: ['gene'],
      rects: [],
      uuid: 'uuid',
      meta: {type: 'Gene', id: '1', idType: 'NCBI', allText: 'gene', links: {}, isCustom: true},
    } as any);

    // Bootstrap 5 collapse reads only data-bs-*; data-toggle/data-target did nothing.
    expect(content.querySelector('[data-toggle], [data-target]')).toBeNull();
    const toggles = Array.from(content.querySelectorAll('[data-bs-toggle="collapse"]'));
    expect(toggles.length).toBe(2);
    for (const toggle of toggles) {
      expect(content.querySelector(toggle.getAttribute('data-bs-target'))).not.toBeNull();
    }
    expect(content.querySelector('button')).not.toBeNull();
  });
  // it(`should have as title 'app'`, async(() => {
  //   const fixture = TestBed.createComponent(AppComponent);
  //   const app = fixture.debugElement.componentInstance;
  //   expect(app.title).toEqual('app');
  // }));
  // it('should render title in a h1 tag', async(() => {
  //   const fixture = TestBed.createComponent(AppComponent);
  //   fixture.detectChanges();
  //   const compiled = fixture.debugElement.nativeElement;
  //   expect(compiled.querySelector('h1').textContent).toContain('Welcome to app!');
  // }));
});
