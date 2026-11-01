import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { errorMessage } from '../../../core/utils/error.utils';

/** Asks for a password-reset link. Always shows the same message, so it never reveals which emails exist. */
@Component({
  selector: 'pp-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private auth = inject(AuthService);

  protected email = inject(NonNullableFormBuilder).control('', [Validators.required, Validators.email]);
  protected submitting = signal(false);
  protected sentTo = signal<string | null>(null);
  protected error = signal<string | null>(null);

  submit(): void {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth.requestPasswordReset(this.email.value).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => this.sentTo.set(this.email.value.trim()),
      error: e => this.error.set(errorMessage(e)),
    });
  }
}
