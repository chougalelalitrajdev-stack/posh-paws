import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { AlertService } from '../services/alert.service';

/** Catches errors nothing else handled, so the user sees a message instead of a silently broken page. */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private alert = inject(AlertService);

  handleError(error: unknown): void {
    // Failed API calls were already reported by the error interceptor.
    if (error instanceof HttpErrorResponse) return;
    console.error(error);
    this.alert.error('Something went wrong. Please refresh the page and try again.');
  }
}
