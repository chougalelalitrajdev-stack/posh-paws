import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { MOCK_PASSWORD } from '../mocks/mock-data';
import { mockInterceptor } from '../mocks/mock.interceptor';
import { AuthService } from './auth.service';

describe('AuthService (against the mock API)', () => {
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    auth = TestBed.inject(AuthService);
  });

  it('signs in with a demo account and knows its role', async () => {
    await auth.login('  Meera@PoshPaws.in ', MOCK_PASSWORD, true);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.user()?.role).toBe('admin');
    expect(auth.hasRole('super_admin', 'admin')).toBe(true);
    expect(auth.hasRole('super_admin')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.authToken)).not.toBeNull();
  });

  it('keeps the session only for the tab when "keep me signed in" is off', async () => {
    await auth.login('amit@poshpaws.in', MOCK_PASSWORD, false);
    expect(sessionStorage.getItem(STORAGE_KEYS.authToken)).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.authToken)).toBeNull();
  });

  it('rejects a wrong password with 401 and a readable message', async () => {
    const error = await auth.login('owner@poshpaws.in', 'nope', true).catch(e => e as HttpErrorResponse);
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(401);
    expect((error as HttpErrorResponse).error.detail).toContain("don't match");
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('clears everything on logout', async () => {
    await auth.login('owner@poshpaws.in', MOCK_PASSWORD, true);
    auth.logout();
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.authUser)).toBeNull();
  });
});
