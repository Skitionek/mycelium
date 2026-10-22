import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Subject } from 'rxjs';

import { FilesystemObject } from '../models/filesystem-object';
import { OfficeThumbnailService } from '../services/office-thumbnail.service';
import { ObjectThumbnailComponent } from './object-thumbnail.component';

@Component({
  template: `
    <div [style.margin-top]="offscreen ? '5000px' : '0'">
      <app-object-thumbnail [object]="object" width="3rem">
        <i class="file-icon"></i>
      </app-object-thumbnail>
    </div>
  `,
})
class HostComponent {
  object: FilesystemObject;
  offscreen = false;
}

function file(filename: string) {
  return new FilesystemObject().update({
    hashId: `hash-${filename}`, filename, mimeType: 'application/octet-stream', modifiedDate: '2026-01-01T00:00:00',
  });
}

async function until(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  expect(condition()).toBe(true);
}

describe('ObjectThumbnailComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let handles: boolean;
  let rendered: Blob;
  let requests: { object: FilesystemObject, priority: number, thumbnail: Subject<Blob> }[];

  const image = (): HTMLImageElement => fixture.nativeElement.querySelector('img');
  const icon = () => fixture.nativeElement.querySelector('.file-icon');

  function show(object: FilesystemObject, offscreen = false) {
    fixture.componentInstance.object = object;
    fixture.componentInstance.offscreen = offscreen;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    handles = true;
    rendered = undefined;
    requests = [];
    await TestBed.configureTestingModule({
      declarations: [HostComponent, ObjectThumbnailComponent],
      providers: [{
        provide: OfficeThumbnailService,
        useValue: {
          handles: (object: FilesystemObject) => handles && object.filename.endsWith('.docx'),
          getRendered: () => rendered,
          thumbnail(object: FilesystemObject, priority: number) {
            const thumbnail = new Subject<Blob>();
            requests.push({object, priority, thumbnail});
            return thumbnail;
          },
        },
      }],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  it('shows the projected icon, and requests nothing, when office thumbnails are switched off', async () => {
    handles = false;
    show(file('report.docx'));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(icon()).not.toBeNull();
    expect(image()).toBeNull();
    expect(requests.length).toBe(0);
  });

  it('shows the projected icon for files that are not office files', async () => {
    show(file('structure.pdb'));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(icon()).not.toBeNull();
    expect(requests.length).toBe(0);
  });

  it('requests the thumbnail once on screen and shows it instead of the icon', async () => {
    show(file('report.docx'));
    expect(icon()).not.toBeNull();
    await until(() => requests.length === 1);
    expect(requests[0].object.filename).toBe('report.docx');
    expect(requests[0].priority).toBe(0);

    requests[0].thumbnail.next(new Blob(['png'], {type: 'image/png'}));
    fixture.detectChanges();
    expect(icon()).toBeNull();
    expect(image().src).toMatch(/^blob:/);
    expect(image().style.maxWidth).toBe('3rem');
    expect(image().style.maxHeight).toBe('calc(3.75rem)');
  });

  it('does not request thumbnails that are off screen', async () => {
    show(file('report.docx'), true);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(requests.length).toBe(0);
  });

  it('drops the request when it leaves the screen, and requests it again when it is back', async () => {
    const object = file('report.docx');
    show(object);
    await until(() => requests.length === 1);
    show(object, true);
    await until(() => !requests[0].thumbnail.observed);
    show(object);
    await until(() => requests.length === 2);
    expect(requests[1].thumbnail.observed).toBe(true);
  });

  it('carries on when given the same version of the file again', async () => {
    show(file('report.docx'));
    await until(() => requests.length === 1);
    show(file('report.docx'));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(requests.length).toBe(1);
    expect(requests[0].thumbnail.observed).toBe(true);
  });

  it('shows thumbnails rendered before right away', () => {
    rendered = new Blob(['png'], {type: 'image/png'});
    show(file('report.docx'));
    fixture.detectChanges();
    expect(image()).not.toBeNull();
    expect(requests.length).toBe(0);
  });

  it('keeps the icon when the thumbnail cannot be rendered', async () => {
    show(file('broken.docx'));
    await until(() => requests.length === 1);
    requests[0].thumbnail.error(new Error('broken'));
    fixture.detectChanges();
    expect(icon()).not.toBeNull();
    expect(image()).toBeNull();
  });

  it('drops the request when removed', async () => {
    show(file('report.docx'));
    await until(() => requests.length === 1);
    fixture.destroy();
    expect(requests[0].thumbnail.observed).toBe(false);
  });
});
