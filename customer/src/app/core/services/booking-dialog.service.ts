import { Injectable, signal } from '@angular/core';

export type BookingDialogStep = 'choice' | 'callback-form' | 'callback-success';

export interface BookingDialogContext {
  petType?: 'dog' | 'cat';
  serviceName?: string;
}

/**
 * Drives the global "How would you like to book?" dialog.
 * Any component can call open() — the dialog itself is mounted once
 * in the app shell (see app.html) and reacts to this service's state.
 */
@Injectable({ providedIn: 'root' })
export class BookingDialogService {
  readonly isOpen = signal(false);
  readonly step = signal<BookingDialogStep>('choice');
  readonly context = signal<BookingDialogContext | null>(null);

  open(context?: BookingDialogContext): void {
    this.context.set(context ?? null);
    this.step.set('choice');
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  goToCallbackForm(): void {
    this.step.set('callback-form');
  }

  goToChoice(): void {
    this.step.set('choice');
  }

  markCallbackRequested(): void {
    this.step.set('callback-success');
  }
}
