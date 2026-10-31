import { HttpErrorResponse } from '@angular/common/http';

const FALLBACK = 'Something went wrong. Please try again.';

/** A message fit to show the user for any error. Reads the API's `{ "detail": "..." }` body. */
export function errorMessage(error: unknown, fallback = FALLBACK): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    const detail = error.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return 'Please check the details you entered.';
  }
  return fallback;
}
