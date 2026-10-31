import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LoginDialogService } from '../services/login-dialog.service';

/** Prompts for login instead of redirecting; stays put if dismissed mid-session. */
export const authGuard: CanActivateFn = async () => {
  const login = inject(LoginDialogService);
  const router = inject(Router);

  if (await login.ensureLoggedIn()) return true;

  // On a cold load there is no page to stay on, so fall back to home.
  return router.navigated ? false : router.createUrlTree(['/']);
};
