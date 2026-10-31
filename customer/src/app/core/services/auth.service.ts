import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { AuthResponse, NewUserProfile, User, VerifyOtpResponse } from '../models/user.model';
import { readJson, removeItem, writeJson } from '../utils/storage.utils';
import { digitsOnly } from '../utils/text.utils';

/**
 * Login session (phone + OTP). Holds the current user and the API token.
 * Calls skip the global error toast because the login dialog shows errors itself.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private readonly _user = signal<User | null>(this.restoreUser());
  private _token = readJson<string | null>(STORAGE_KEYS.authToken, null);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  /** Bearer token for API calls; null when logged out. */
  token(): string | null {
    return this._token;
  }

  async sendOtp(phone: string): Promise<void> {
    await firstValueFrom(
      this.http.post(API.auth.sendOtp, { phone: digitsOnly(phone) }, { context: withoutErrorAlert() }),
    );
  }

  /** Logs a known user in. Returns 'new-user' when the number has no account yet. */
  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse['status']> {
    const res = await firstValueFrom(
      this.http.post<VerifyOtpResponse>(API.auth.verifyOtp, { phone: digitsOnly(phone), code }, { context: withoutErrorAlert() }),
    );
    if (res.status === 'authenticated') this.startSession(res);
    return res.status;
  }

  async register(phone: string, profile: NewUserProfile): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(API.auth.register, { phone: digitsOnly(phone), ...profile }, { context: withoutErrorAlert() }),
    );
    this.startSession(res);
  }

  logout(): void {
    this._user.set(null);
    this._token = null;
    removeItem(STORAGE_KEYS.authUser);
    removeItem(STORAGE_KEYS.authToken);
  }

  private startSession({ user, token }: AuthResponse): void {
    this._token = token;
    this._user.set(user);
    writeJson(STORAGE_KEYS.authToken, token);
    writeJson(STORAGE_KEYS.authUser, user);
  }

  private restoreUser(): User | null {
    const user = readJson<User | null>(STORAGE_KEYS.authUser, null);
    return user && readJson<string | null>(STORAGE_KEYS.authToken, null) ? user : null;
  }
}
