import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { AuthResponse, StaffRole, StaffUser } from '../models/staff-user.model';
import { readJson, removeItem, writeJson } from '../utils/storage.utils';

/**
 * Staff session (email + password). "Keep me signed in" stores it in localStorage,
 * otherwise in sessionStorage so it ends when the tab closes.
 * Calls skip the global error toast because the login screens show errors themselves.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private storage = this.findSessionStorage();
  private readonly _user = signal<StaffUser | null>(readJson<StaffUser | null>(STORAGE_KEYS.authUser, null, this.storage));
  private _token = readJson<string | null>(STORAGE_KEYS.authToken, null, this.storage);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null && this._token !== null);

  /** Bearer token for API calls; null when signed out. */
  token(): string | null {
    return this._token;
  }

  hasRole(...roles: StaffRole[]): boolean {
    const role = this._user()?.role;
    return !!role && roles.includes(role);
  }

  async login(email: string, password: string, remember: boolean): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(API.auth.login, { email: email.trim().toLowerCase(), password }, { context: withoutErrorAlert() }),
    );
    this.clearStorage();
    this.storage = remember ? localStorage : sessionStorage;
    this._token = res.token;
    this._user.set(res.user);
    writeJson(STORAGE_KEYS.authToken, res.token, this.storage);
    writeJson(STORAGE_KEYS.authUser, res.user, this.storage);
  }

  async requestPasswordReset(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post(API.auth.forgotPassword, { email: email.trim().toLowerCase() }, { context: withoutErrorAlert() }),
    );
  }

  logout(): void {
    this._token = null;
    this._user.set(null);
    this.clearStorage();
  }

  private clearStorage(): void {
    for (const storage of [localStorage, sessionStorage]) {
      removeItem(STORAGE_KEYS.authToken, storage);
      removeItem(STORAGE_KEYS.authUser, storage);
    }
  }

  /** The session lives wherever the last login put it. */
  private findSessionStorage(): Storage {
    return readJson<string | null>(STORAGE_KEYS.authToken, null, sessionStorage) ? sessionStorage : localStorage;
  }
}
