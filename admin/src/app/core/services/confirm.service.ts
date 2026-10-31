import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label of the confirming button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label of the cancelling button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** 'danger' paints the confirm button red (archive, cancel booking, refund...). */
  tone?: 'default' | 'danger';
}

/**
 * "Are you sure?" questions. Shown by <pp-confirm-dialog>, mounted once in app.html.
 *   if (await confirm.ask({ title: 'Archive service?', tone: 'danger' })) { ... }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _request = signal<ConfirmOptions | null>(null);
  private resolve: ((ok: boolean) => void) | null = null;

  readonly request = this._request.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this.settle(false);
    this._request.set(options);
    return new Promise(resolve => (this.resolve = resolve));
  }

  settle(ok: boolean): void {
    this.resolve?.(ok);
    this.resolve = null;
    this._request.set(null);
  }
}
