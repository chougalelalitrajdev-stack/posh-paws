import { Component, HostListener, computed, effect, inject, signal, untracked, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginDialogService } from '../../../core/auth/login-dialog.service';
import { PHONE_MIN_DIGITS, normalizePhone } from '../../../core/auth/auth.models';

const OTP_LENGTH = 6;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

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
  protected readonly devHint = this.auth.devHint;

  protected phoneInput = signal('');
  protected code = signal('');
  protected name = signal('');
  protected email = signal('');
  protected submitting = signal(false);
  protected error = signal<string | null>(null);

  protected phoneValid = computed(() => normalizePhone(this.phoneInput()).length >= PHONE_MIN_DIGITS);
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

  async submitPhone(): Promise<void> {
    if (!this.phoneValid()) return;
    await this.run(async () => {
      await this.auth.sendOtp(this.phoneInput());
      this.code.set('');
      this.dialog.goToOtp(this.phoneInput());
    });
  }

  async submitCode(): Promise<void> {
    if (!this.codeValid()) return;
    await this.run(async () => {
      const result = await this.auth.verifyOtp(this.dialog.phone(), this.code());
      if (result.status === 'authenticated') this.dialog.complete();
      else if (result.status === 'new-user') this.dialog.goToProfile();
      else this.error.set('That code is incorrect. Please try again.');
    });
  }

  async submitProfile(): Promise<void> {
    if (!this.profileValid()) return;
    await this.run(async () => {
      const email = this.email().trim();
      await this.auth.createProfile(this.dialog.phone(), {
        name: this.name().trim(),
        ...(email && { email }),
      });
      this.dialog.complete();
    });
  }

  async resendCode(): Promise<void> {
    await this.run(() => this.auth.sendOtp(this.dialog.phone()));
  }

  changeNumber(): void {
    this.error.set(null);
    this.dialog.goToPhone();
  }

  onPhoneChange(e: Event): void {
    this.phoneInput.set((e.target as HTMLInputElement).value);
  }

  onCodeChange(e: Event): void {
    this.code.set(normalizePhone((e.target as HTMLInputElement).value).slice(0, OTP_LENGTH));
  }

  onNameChange(e: Event): void {
    this.name.set((e.target as HTMLInputElement).value);
  }

  onEmailChange(e: Event): void {
    this.email.set((e.target as HTMLInputElement).value);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      await action();
    } catch {
      this.error.set(GENERIC_ERROR);
    } finally {
      this.submitting.set(false);
    }
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
