import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { RouteBuilderComponent } from './route-builder.component';

describe('RouteBuilderComponent', () => {
  let component: RouteBuilderComponent;
  let fixture: ComponentFixture<RouteBuilderComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        RootStoreModule,
        SharedModule
      ],
      declarations: [ RouteBuilderComponent ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
