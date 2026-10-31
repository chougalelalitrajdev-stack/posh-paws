import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

export type LoginDialogStep = 'phone' | 'otp' | 'profile';

/**
 * UI state for the global login dialog. Features never touch this
 * directly — they call ensureLoggedIn() and await the outcome.
 */
@Injectable({ providedIn: 'root' })
export class LoginDialogService {
  private auth = inject(AuthService);

  readonly isOpen = signal(false);
  readonly step = signal<LoginDialogStep>('phone');
  readonly phone = signal('');

  private pending: ((loggedIn: boolean) => void) | null = null;

  /** Resolves true when the user is (or becomes) logged in, false if they dismiss. */
  ensureLoggedIn(): Promise<boolean> {
    if (this.auth.isLoggedIn()) return Promise.resolve(true);

    this.settle(false);
    this.step.set('phone');
    this.phone.set('');
    this.isOpen.set(true);
    return new Promise(resolve => (this.pending = resolve));
  }

  goToOtp(phone: string): void {
    this.phone.set(phone);
    this.step.set('otp');
  }

  goToProfile(): void {
    this.step.set('profile');
  }

  goToPhone(): void {
    this.step.set('phone');
  }

  complete(): void {
    this.isOpen.set(false);
    this.settle(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.settle(false);
  }

  private settle(loggedIn: boolean): void {
    this.pending?.(loggedIn);
    this.pending = null;
  }
}
