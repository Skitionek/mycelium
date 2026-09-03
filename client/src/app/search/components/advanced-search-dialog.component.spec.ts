
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MockComponent } from 'ng-mocks';
import { of } from 'rxjs';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { AdvancedSearchDialogComponent } from './advanced-search-dialog.component';
import { HierarchySearchTreeComponent } from './hierarchy-search-tree.component';
import { ContentSearchService } from '../services/content-search.service';

describe('AdvancedSearchDialogComponent', () => {
  let component: AdvancedSearchDialogComponent;
  let fixture: ComponentFixture<AdvancedSearchDialogComponent>;
  let filesystemServiceSpy: jasmine.SpyObj<FilesystemService>;

  beforeEach(waitForAsync(() => {
    filesystemServiceSpy = jasmine.createSpyObj('FilesystemService', ['getHierarchy']);
    filesystemServiceSpy.getHierarchy.and.returnValue(of({ results: [] } as any));

    TestBed.configureTestingModule({
      imports: [
        RootStoreModule,
        SharedModule,
        BrowserAnimationsModule,
        RouterTestingModule
      ],
      declarations: [
        AdvancedSearchDialogComponent,
        MockComponent(HierarchySearchTreeComponent)
      ],
      providers: [
        ContentSearchService,
        { provide: FilesystemService, useValue: filesystemServiceSpy },
        NgbActiveModal,
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AdvancedSearchDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
