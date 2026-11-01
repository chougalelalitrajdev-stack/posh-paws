import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { LoginDialogService } from '../services/login-dialog.service';

/** Prompts for login instead of redirecting; stays put if dismissed mid-session. */
export const authGuard: CanActivateFn = () => {
  const login = inject(LoginDialogService);
  const router = inject(Router);

  // On a cold load there is no page to stay on, so a dismissed dialog falls back to home.
  return login.ensureLoggedIn().pipe(map(loggedIn => loggedIn || (router.navigated ? false : router.createUrlTree(['/']))));
};
