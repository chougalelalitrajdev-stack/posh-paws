import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { StaffUser } from '../models/staff-user.model';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { roleGuard } from './role.guard';

function signInAs(user: StaffUser | null): void {
  localStorage.clear();
  if (user) {
    localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.authToken, JSON.stringify('t'));
  }
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
}

const run = (guard: ReturnType<typeof roleGuard>) =>
  TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

describe('roleGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lets an allowed role through', () => {
    signInAs({ id: '1', name: 'A', email: 'a@x', role: 'admin' });
    expect(run(roleGuard('super_admin', 'admin'))).toBe(true);
  });

  it('sends other roles home', () => {
    signInAs({ id: '1', name: 'S', email: 's@x', role: 'staff' });
    const result = run(roleGuard('super_admin', 'admin'));
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/');
  });
});
