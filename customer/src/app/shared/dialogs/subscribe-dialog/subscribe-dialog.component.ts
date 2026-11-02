import { Component, HostListener, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, switchMap, timer } from 'rxjs';
import { MembershipService } from '../../../core/services/membership.service';
import { SubscribeDialogService } from '../../../core/services/subscribe-dialog.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { InrPipe } from '../../pipes/inr.pipe';

@Component({
  selector: 'pp-subscribe-dialog',
  standalone: true,
  imports: [RouterLink, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscribe-dialog.component.html',
  styleUrl: './subscribe-dialog.component.scss',
})
export class SubscribeDialogComponent {
  protected dialog = inject(SubscribeDialogService);
  private membership = inject(MembershipService);
  protected submitting = signal(false);
  protected error = signal<string | null>(null);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.isOpen()) this.close();
  }

  close(): void {
    if (this.submitting()) return;
    this.error.set(null);
    this.dialog.close();
  }

  goToPayment(): void {
    this.dialog.goToPayment();
  }

  backToConfirm(): void {
    this.dialog.goToConfirm();
  }

  confirmPayment(): void {
    const plan = this.dialog.plan();
    if (!plan || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    // No payment gateway exists yet: simulate the charge, then start the plan.
    timer(700).pipe(
      switchMap(() => this.membership.subscribe(plan.id)),
      finalize(() => this.submitting.set(false)),
    ).subscribe({
      next: () => this.dialog.markSubscribed(),
      error: e => this.error.set(errorMessage(e)),
    });
  }
}
