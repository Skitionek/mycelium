import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Store } from '@ngrx/store';
import { MockComponents, MockDirectives, MockProvider } from 'ng-mocks';

import { LoginComponent } from 'app/auth/components/login.component';
import { FormInputFeedbackComponent } from 'app/shared/components/form/form-input-feedback.component';
import { FormRowComponent } from 'app/shared/components/form/form-row.component';
import { AutoFocusDirective } from 'app/shared/directives/auto-focus.directive';
import { FormInputDirective } from 'app/shared/directives/form-input.directive';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { AccountService } from 'app/users/services/account.service';

describe('LoginComponent', () => {
    let component: LoginComponent;
    let fixture: ComponentFixture<LoginComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [
                LoginComponent,
                FormRowComponent,
                MockComponents(FormInputFeedbackComponent),
                MockDirectives(FormInputDirective, AutoFocusDirective),
            ],
            imports: [CommonModule, ReactiveFormsModule],
            providers: [
                MockProvider(Store),
                MockProvider(MessageDialog),
                MockProvider(NgbModal),
                MockProvider(ProgressDialog),
                MockProvider(MatSnackBar),
                MockProvider(ErrorHandler),
                MockProvider(AccountService),
            ],
        })
    .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(LoginComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should report each field\'s errors under that field', () => {
        const rows = fixture.debugElement.queryAll(By.directive(FormRowComponent))
            .map(row => row.componentInstance as FormRowComponent);

        expect(rows.length).toBe(2);
        expect(rows[0].control).toBe(component.form.get('email'));
        expect(rows[1].control).toBe(component.form.get('password'));
    });
});
