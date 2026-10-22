import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatLegacySnackBar } from '@angular/material/legacy-snack-bar';

import { AccountService } from 'app/users/services/account.service';

/**
 * Landing page for the link in a password reset email.
 *
 * The token in the URL is the only credential here, so the page is reachable
 * without logging in. It is spent by the POST; the backend rejects a replay.
 */
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  // Kept in sync with MIN_PASSWORD_LENGTH on the backend, which rejects
  // anything shorter regardless of what this form allows.
  static readonly MIN_PASSWORD_LENGTH = 8;

  readonly form = new FormGroup({
    newPassword: new FormControl('', [
      Validators.required,
      Validators.minLength(ResetPasswordComponent.MIN_PASSWORD_LENGTH),
    ]),
    confirmPassword: new FormControl('', [Validators.required]),
  });

  readonly minPasswordLength = ResetPasswordComponent.MIN_PASSWORD_LENGTH;

  submitting = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly snackBar: MatLegacySnackBar,
    private readonly accountService: AccountService
  ) {}

  get passwordsMatch(): boolean {
    return this.form.value.newPassword === this.form.value.confirmPassword;
  }

  submit() {
    if (this.form.invalid || !this.passwordsMatch) {
      return;
    }

    const token = this.route.snapshot.paramMap.get('token');
    this.submitting = true;

    this.accountService.completePasswordReset(token, this.form.value.newPassword).subscribe(
      () => {
        this.submitting = false;
        this.snackBar.open(
          'Your password has been reset. Please log in with your new password.',
          'close',
          {duration: 5000},
        );
        this.router.navigate(['/login']);
      },
      () => {
        this.submitting = false;
        // The backend answers the same way for an expired, forged, or
        // already-spent link, so there is nothing more specific to say.
        this.snackBar.open(
          'This password reset link is invalid or has expired. Please request a new one.',
          'close',
          {duration: 8000},
        );
      },
    );
  }
}
