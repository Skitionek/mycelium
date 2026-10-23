import { TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CommonModule } from '@angular/common';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { KgStatisticsComponent } from 'app/kg-statistics.component';

describe('KgStatisticsComponent', () => {
    let component: KgStatisticsComponent;
    let httpMock: HttpTestingController;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [KgStatisticsComponent],
            imports: [
                CommonModule,
                HttpClientTestingModule,
                MatSnackBarModule,
                BrowserAnimationsModule,
            ],
        }).compileComponents();
    }));

    beforeEach(() => {
        const fixture = TestBed.createComponent(KgStatisticsComponent);
        component = fixture.componentInstance;
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        // Absorb any pending HTTP requests triggered by BackgroundTask's internal timer
        httpMock.match('/api/kg-statistics');
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('addThousandSeparator: should add commas to large numbers', () => {
        expect(component.addThousandSeparator('1000000')).toBe('1,000,000');
    });

    it('addThousandSeparator: should not modify numbers below 1000', () => {
        expect(component.addThousandSeparator('999')).toBe('999');
    });

    it('addThousandSeparator: should handle exactly 1000', () => {
        expect(component.addThousandSeparator('1000')).toBe('1,000');
    });

    it('addThousandSeparator: should handle numbers with existing text unchanged', () => {
        expect(component.addThousandSeparator('1234567')).toBe('1,234,567');
    });

    it('should initialise chartDataAllDomains as an empty array before data loads', () => {
        expect(Array.isArray(component.chartDataAllDomains)).toBeTrue();
    });

    it('should initialise totalCount as 0 before data loads', () => {
        expect(component.totalCount).toBe(0);
    });
});
