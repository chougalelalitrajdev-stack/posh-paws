import { HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AlertService } from '../services/alert.service';
import { AuthService } from '../services/auth.service';
import { errorMessage } from '../utils/error.utils';

const SKIP_ERROR_ALERT = new HttpContextToken<boolean>(() => false);

/** Pass as a request's `context` when the screen shows the error itself. */
export function withoutErrorAlert(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_ALERT, true);
}

/**
 * One place for failed API calls: an expired session signs the user out and returns
 * to the login page; anything else becomes a toast. The error is re-thrown so callers can still react.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const alert = inject(AlertService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.isLoggedIn()) {
        auth.logout();
        alert.info('Your session has ended. Please sign in again.');
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      } else if (error.status === 403) {
        alert.error("You don't have permission to do that.");
      } else if (!req.context.get(SKIP_ERROR_ALERT)) {
        alert.error(errorMessage(error));
      }
      return throwError(() => error);
    }),
  );
};
