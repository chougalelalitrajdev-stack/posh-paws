import { Injectable, computed, signal } from '@angular/core';

/** Counts API calls in flight; <pp-loader> shows a progress bar while any are running. */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  private readonly pending = signal(0);

  readonly isLoading = computed(() => this.pending() > 0);

  start(): void {
    this.pending.update(n => n + 1);
  }

  stop(): void {
    this.pending.update(n => Math.max(0, n - 1));
  }
}
