import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subscriber, defer, of } from 'rxjs';
import { AuthService } from './auth.service';

export type LoginDialogStep = 'phone' | 'otp' | 'profile';

/**
 * UI state for the global login dialog. Features never touch this
 * directly — they subscribe to ensureLoggedIn() and act on the outcome.
 */
@Injectable({ providedIn: 'root' })
export class LoginDialogService {
  private auth = inject(AuthService);

  readonly isOpen = signal(false);
  readonly step = signal<LoginDialogStep>('phone');
  readonly phone = signal('');

  /** Whoever is waiting for the dialog to finish. */
  private pending: Subscriber<boolean> | null = null;

  /**
   * Emits true (then completes) when the user is, or becomes, logged in; false if they dismiss.
   * Nothing opens until it is subscribed. If the caller stops waiting (e.g. a guarded navigation
   * is replaced by another), the dialog closes.
   */
  ensureLoggedIn(): Observable<boolean> {
    return defer(() => {
      if (this.auth.isLoggedIn()) return of(true);
      this.settle(false); // an older request loses to this one
      this.step.set('phone');
      this.phone.set('');
      this.isOpen.set(true);
      return new Observable<boolean>(subscriber => {
        this.pending = subscriber;
        return () => {
          if (this.pending !== subscriber) return;
          this.pending = null;
          this.isOpen.set(false);
        };
      });
    });
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
    const waiting = this.pending;
    this.pending = null;
    waiting?.next(loggedIn);
    waiting?.complete();
  }
}
