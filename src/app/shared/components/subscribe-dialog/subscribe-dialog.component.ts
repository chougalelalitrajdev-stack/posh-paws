import { Component, HostListener, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SubscribeDialogService } from '../../../core/services/subscribe-dialog.service';

@Component({
  selector: 'pp-subscribe-dialog',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscribe-dialog.component.html',
})
export class SubscribeDialogComponent {
  protected dialog = inject(SubscribeDialogService);
  protected submitting = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.isOpen()) this.close();
  }

  close(): void {
    if (this.submitting()) return;
    this.dialog.close();
  }

  goToPayment(): void {
    this.dialog.goToPayment();
  }

  backToConfirm(): void {
    this.dialog.goToConfirm();
  }

  confirmPayment(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    // No payment gateway exists yet — simulate the charge completing.
    setTimeout(() => {
      this.submitting.set(false);
      this.dialog.markSubscribed();
    }, 700);
  }
}
