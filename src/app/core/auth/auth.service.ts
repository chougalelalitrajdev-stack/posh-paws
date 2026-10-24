import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthProvider } from './auth.provider';
import { AuthUser, NewUserProfile, VerifyOtpResult, normalizePhone } from './auth.models';

const SESSION_KEY = 'pp_auth_user';

/** Session state. All backend work is delegated to the injected AuthProvider. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private provider = inject(AuthProvider);

  private readonly _user = signal<AuthUser | null>(this.restoreSession());

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly devHint = this.provider.devHint;

  sendOtp(phone: string): Promise<void> {
    return this.provider.sendOtp(normalizePhone(phone));
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
    const result = await this.provider.verifyOtp(normalizePhone(phone), code);
    if (result.status === 'authenticated') this.startSession(result.user);
    return result;
  }

  async createProfile(phone: string, profile: NewUserProfile): Promise<void> {
    const user = await this.provider.createProfile(normalizePhone(phone), profile);
    this.startSession(user);
  }

  logout(): void {
    this._user.set(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing persisted to clear.
    }
  }

  private startSession(user: AuthUser): void {
    this._user.set(user);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
      // Session lasts until reload when storage is unavailable.
    }
  }

  private restoreSession(): AuthUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
