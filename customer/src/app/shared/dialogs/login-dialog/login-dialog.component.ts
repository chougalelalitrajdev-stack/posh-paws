import { Component, HostListener, computed, effect, inject, signal, untracked, ChangeDetectionStrategy } from '@angular/core';
import { Observable, finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LoginDialogService } from '../../../core/services/login-dialog.service';
import { OTP_LENGTH, PHONE_MIN_DIGITS } from '../../../core/constants/app.constants';
import { MOCK_OTP } from '../../../core/mocks/mock-data';
import { errorMessage } from '../../../core/utils/error.utils';
import { digitsOnly } from '../../../core/utils/text.utils';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'pp-login-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.scss',
})
export class LoginDialogComponent {
  protected dialog = inject(LoginDialogService);
  private auth = inject(AuthService);

  protected readonly otpLength = OTP_LENGTH;
  protected readonly devHint = environment.useMocks ? `Demo mode — use code ${MOCK_OTP}.` : null;

  protected phoneInput = signal('');
  protected code = signal('');
  protected name = signal('');
  protected email = signal('');
  protected submitting = signal(false);
  protected error = signal<string | null>(null);

  protected phoneValid = computed(() => digitsOnly(this.phoneInput()).length >= PHONE_MIN_DIGITS);
  protected codeValid = computed(() => this.code().length === OTP_LENGTH);
  protected profileValid = computed(() => this.name().trim().length > 0);

  constructor() {
    effect(() => {
      if (this.dialog.isOpen()) untracked(() => this.resetForm());
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.isOpen()) this.close();
  }

  close(): void {
    if (this.submitting()) return;
    this.dialog.close();
  }

  submitPhone(): void {
    if (!this.phoneValid()) return;
    this.run(this.auth.sendOtp(this.phoneInput()), () => {
      this.code.set('');
      this.dialog.goToOtp(this.phoneInput());
    });
  }

  submitCode(): void {
    if (!this.codeValid()) return;
    this.run(this.auth.verifyOtp(this.dialog.phone(), this.code()), status => {
      if (status === 'authenticated') this.dialog.complete();
      else this.dialog.goToProfile();
    });
  }

  submitProfile(): void {
    if (!this.profileValid()) return;
    const email = this.email().trim();
    this.run(this.auth.register(this.dialog.phone(), { name: this.name().trim(), ...(email && { email }) }), () => this.dialog.complete());
  }

  resendCode(): void {
    this.run(this.auth.sendOtp(this.dialog.phone()), () => undefined);
  }

  changeNumber(): void {
    this.error.set(null);
    this.dialog.goToPhone();
  }

  onPhoneChange(e: Event): void {
    this.phoneInput.set((e.target as HTMLInputElement).value);
  }

  onCodeChange(e: Event): void {
    this.code.set(digitsOnly((e.target as HTMLInputElement).value).slice(0, OTP_LENGTH));
  }

  onNameChange(e: Event): void {
    this.name.set((e.target as HTMLInputElement).value);
  }

  onEmailChange(e: Event): void {
    this.email.set((e.target as HTMLInputElement).value);
  }

  /** Runs one request at a time; errors show inline in the dialog. */
  private run<T>(request: Observable<T>, done: (value: T) => void): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: done,
      error: e => this.error.set(errorMessage(e)),
    });
  }

  private resetForm(): void {
    this.phoneInput.set('');
    this.code.set('');
    this.name.set('');
    this.email.set('');
    this.submitting.set(false);
    this.error.set(null);
  }
}
