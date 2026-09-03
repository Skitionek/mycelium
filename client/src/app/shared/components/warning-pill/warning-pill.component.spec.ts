import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject } from 'rxjs';
import { MockComponents } from 'ng-mocks';

import { WarningPillComponent } from 'app/shared/components/warning-pill/warning-pill.component';
import { WarningListComponent } from 'app/shared/components/warning-list/warning-list.component';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

describe('WarningPillComponent', () => {
    let component: WarningPillComponent;
    let fixture: ComponentFixture<WarningPillComponent>;
    let warningControllerSpy: jasmine.SpyObj<WarningControllerService>;

    beforeEach(waitForAsync(() => {
        warningControllerSpy = jasmine.createSpyObj('WarningControllerService', [], {
            warnings: new BehaviorSubject([]),
        });

        TestBed.configureTestingModule({
            declarations: [
                WarningPillComponent,
                MockComponents(WarningListComponent),
            ],
            imports: [CommonModule, NgbModule],
            providers: [
                { provide: WarningControllerService, useValue: warningControllerSpy },
            ],
        })
    .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(WarningPillComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should not render the badge when there are no warnings', () => {
        (warningControllerSpy.warnings as BehaviorSubject<any[]>).next([]);
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('.bg-warning')).toBeNull();
    });

    it('should render the badge when there are warnings', () => {
        (warningControllerSpy.warnings as BehaviorSubject<any[]>).next(['warning one']);
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('.bg-warning')).not.toBeNull();
    });
});
