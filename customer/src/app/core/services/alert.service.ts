import { Injectable, signal } from '@angular/core';

export type AlertType = 'success' | 'error' | 'info';

export interface Alert {
  id: number;
  type: AlertType;
  message: string;
}

const DISMISS_AFTER_MS = 4000;

/** App-wide toast messages. Shown by <pp-toast>, mounted once in app.html. */
@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly _alerts = signal<Alert[]>([]);
  private nextId = 0;

  readonly alerts = this._alerts.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  dismiss(id: number): void {
    this._alerts.update(list => list.filter(a => a.id !== id));
  }

  private show(type: AlertType, message: string): void {
    const id = ++this.nextId;
    // The same message twice in a row replaces the first instead of stacking.
    this._alerts.update(list => [...list.filter(a => a.message !== message), { id, type, message }]);
    setTimeout(() => this.dismiss(id), DISMISS_AFTER_MS);
  }
}
