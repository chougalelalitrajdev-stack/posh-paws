import { Component, HostListener, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { BookingDialogService } from '../../../core/services/booking-dialog.service';
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from '../../../core/constants/app.constants';

@Component({
  selector: 'pp-booking-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-dialog.component.html',
  styleUrl: './booking-dialog.component.scss',
})
export class BookingDialogComponent {
  protected dialog = inject(BookingDialogService);

  protected readonly businessPhoneDisplay = BUSINESS_PHONE_DISPLAY;
  protected readonly businessPhoneTel = `tel:${BUSINESS_PHONE_TEL}`;

  // ── Callback form state ──────────────────────────────────────
  protected name = signal('');
  protected phone = signal('');
  protected submitting = signal(false);

  protected formValid = computed(() =>
    this.name().trim().length > 0 && this.phone().trim().length >= 7
  );

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.isOpen()) this.close();
  }

  close(): void {
    this.dialog.close();
    this.resetForm();
  }

  requestCallback(): void {
    this.dialog.goToCallbackForm();
  }

  backToChoice(): void {
    this.dialog.goToChoice();
  }

  submitCallbackForm(): void {
    if (!this.formValid() || this.submitting()) return;
    this.submitting.set(true);

    // No backend exists yet — simulate the request being sent.
    setTimeout(() => {
      this.submitting.set(false);
      this.dialog.markCallbackRequested();
    }, 700);
  }

  onNameChange(e: Event): void {
    this.name.set((e.target as HTMLInputElement).value);
  }

  onPhoneChange(e: Event): void {
    this.phone.set((e.target as HTMLInputElement).value);
  }

  private resetForm(): void {
    this.name.set('');
    this.phone.set('');
    this.submitting.set(false);
  }
}
