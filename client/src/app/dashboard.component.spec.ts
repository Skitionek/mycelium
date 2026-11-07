import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { of } from 'rxjs';

import { DashboardComponent } from 'app/dashboard.component';
import { MetaDataService } from 'app/shared/services/metadata.service';
import { BuildInfo } from 'app/interfaces';

describe('DashboardComponent', () => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;
    let metaDataServiceSpy: jasmine.SpyObj<MetaDataService>;

    const mockBuildInfo: BuildInfo = {
        buildTimestamp: '2023-01-01T00:00:00Z',
        gitHash: 'abc123',
        appBuildNumber: 42,
        appVersion: '1.0.0',
    };

    beforeEach(waitForAsync(() => {
        metaDataServiceSpy = jasmine.createSpyObj('MetaDataService', ['getBuildInfo']);
        metaDataServiceSpy.getBuildInfo.and.returnValue(of(mockBuildInfo));

        TestBed.configureTestingModule({
            declarations: [DashboardComponent],
            imports: [CommonModule],
            providers: [
                { provide: MetaDataService, useValue: metaDataServiceSpy },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting(),
            ],
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should call getBuildInfo on construction', () => {
        expect(metaDataServiceSpy.getBuildInfo).toHaveBeenCalled();
    });

    it('should expose buildInfo$ observable', () => {
        expect(component.buildInfo$).toBeTruthy();
    });

    it('should display the build timestamp in the template', () => {
        const el: HTMLElement = fixture.nativeElement;
        expect(el.textContent).toContain(mockBuildInfo.buildTimestamp);
    });
});
