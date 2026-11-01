import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LoginDialogService } from './login-dialog.service';

describe('LoginDialogService.ensureLoggedIn', () => {
  let dialog: LoginDialogService;
  const outcome = () => {
    const seen: boolean[] = [];
    const sub = dialog.ensureLoggedIn().subscribe(v => seen.push(v));
    return { seen, sub };
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    dialog = TestBed.inject(LoginDialogService);
  });

  it('opens only when subscribed, and emits true once the user logs in', () => {
    const waiting = dialog.ensureLoggedIn();
    expect(dialog.isOpen()).toBe(false); // lazy

    const { seen, sub } = outcome();
    expect(dialog.isOpen()).toBe(true);
    dialog.complete();
    expect(seen).toEqual([true]);
    expect(sub.closed).toBe(true);
    expect(dialog.isOpen()).toBe(false);
    expect(waiting).toBeDefined();
  });

  it('emits false when dismissed, and an older wait loses to a newer one', () => {
    const first = outcome();
    const second = outcome();
    expect(first.seen).toEqual([false]);
    dialog.close();
    expect(second.seen).toEqual([false]);
  });

  it('closes the dialog when the caller stops waiting', () => {
    const { sub } = outcome();
    sub.unsubscribe();
    expect(dialog.isOpen()).toBe(false);
  });
});
