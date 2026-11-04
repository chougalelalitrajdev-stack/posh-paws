import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PetDialogService } from '../../core/services/pet-dialog.service';
import { PetService } from '../../core/services/pet.service';
import { Pet } from '../../core/models/pet.model';
import { BUSINESS_PHONE_TEL } from '../../core/constants/app.constants';
import { PET_EMOJI } from '../../core/constants/pet.constants';
import { petAgeLabel } from '../../core/utils/pet.utils';
import { BookingService } from '../../core/services/booking.service';
import { Booking } from '../../core/models/booking.model';
import { AlertService } from '../../core/services/alert.service';
import { CatalogService } from '../../core/services/catalog.service';
import { MembershipService } from '../../core/services/membership.service';
import { dateLongLabel, slotStart, timeLabel } from '../../core/utils/date.utils';
import { formatInr } from '../../core/utils/money.utils';
import { BillComponent } from '../../shared/components/bill/bill.component';

// ── Types ─────────────────────────────────────────────────────

interface QuickStat {
  value: string;
  label: string;
  icon: string;
}

// ─────────────────────────────────────────────────────────────

@Component({
  selector: 'pp-account',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, TitleCasePipe, BillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  protected bookingService = inject(BookingService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private petDialog = inject(PetDialogService);
  protected petService = inject(PetService);
  protected membership = inject(MembershipService);
  protected catalog = inject(CatalogService);
  private alert = inject(AlertService);
  protected readonly petEmoji = PET_EMOJI;
  protected readonly petAgeLabel = petAgeLabel;

  protected userName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');

  protected quickStats = computed<QuickStat[]>(() => {
    const plan = this.membership.current();
    return [
      { value: String(this.bookingService.bookings().filter(b => b.status !== 'cancelled').length), label: 'Total bookings', icon: '📋' },
      { value: !plan ? '—' : plan.sessionsLeft === null ? '∞' : String(plan.sessionsLeft), label: 'Sessions left', icon: '🎟️' },
      { value: plan?.discountPercent ? `${plan.discountPercent}%` : '—', label: 'Member discount', icon: '🏷️' },
    ];
  });

  /** Sessions used this month, for the progress bar (unlimited plans have none). */
  protected sessionProgress = computed(() => {
    const plan = this.membership.current();
    return plan?.sessionsTotal ? `${Math.min(100, (plan.sessionsUsed / plan.sessionsTotal) * 100)}%` : null;
  });

  /** Booking whose bill is open. */
  protected openBill = signal<string | null>(null);

  // Tab for bookings section
  protected activeTab = signal<'upcoming' | 'past'>('upcoming');

  setTab(tab: 'upcoming' | 'past'): void {
    this.activeTab.set(tab);
  }

  /** Booking whose Cancel was tapped once and now asks for confirmation. */
  protected confirmingCancel = signal<string | null>(null);
  protected cancelling = signal<string | null>(null);

  protected readonly dateLongLabel = dateLongLabel;
  protected readonly businessPhoneTel = BUSINESS_PHONE_TEL;

  bookingMeta(b: Booking): string {
    return `${dateLongLabel(b.date)} · ${timeLabel(b.time)}`;
  }

  /** One line about the money; the full bill opens below the booking. */
  moneyLine(b: Booking): string {
    const { totalPaise, paidPaise, balancePaise } = b.bill;
    if (b.status === 'cancelled') return b.paymentStatus === 'refunded' ? 'Advance refunded' : paidPaise > 0 ? `${formatInr(paidPaise)} advance kept` : 'Nothing paid';
    if (!totalPaise) return 'Nothing to pay · covered by your plan';
    if (!balancePaise) return `${formatInr(totalPaise)} · paid in full`;
    return `${formatInr(balancePaise)} to pay at the shop${paidPaise ? ` · ${formatInr(paidPaise)} paid` : ''}`;
  }

  toggleBill(id: string): void {
    this.openBill.update(open => (open === id ? null : id));
  }

  /** What cancelling now means for the money (the server applies the same rule). */
  cancelNote(b: Booking): string {
    const advance = b.payments.find(p => p.kind === 'advance');
    const session = b.bill.discount?.kind === 'session' ? ' Your plan session comes back.' : '';
    if (!advance) return `Nothing to refund.${session}`;
    const hours = this.catalog.shop()?.freeCancellationHours ?? 24;
    const early = (slotStart(b.date, b.time).getTime() - Date.now()) / 3_600_000 >= hours;
    return early
      ? `Your ${formatInr(advance.amountPaise)} advance will be refunded.${session}`
      : `It's less than ${hours} hours before your slot, so the ${formatInr(advance.amountPaise)} advance is kept.${session}`;
  }

  cancelBooking(b: Booking): void {
    if (this.confirmingCancel() !== b.id) {
      this.confirmingCancel.set(b.id);
      return;
    }
    this.cancelling.set(b.id);
    this.bookingService.cancel(b.id).pipe(
      finalize(() => {
        this.cancelling.set(null);
        this.confirmingCancel.set(null);
      }),
    ).subscribe({
      next: cancelled => {
        this.membership.reload();
        this.alert.success(cancelled.paymentStatus === 'refunded' ? 'Booking cancelled. Your advance is on its way back.' : 'Booking cancelled.');
      },
      error: () => undefined, // the error interceptor shows a toast
    });
  }

  addPet(): void {
    this.petDialog.open();
  }

  editPet(pet: Pet): void {
    this.petDialog.open(pet);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }

  startBooking(pet?: Pet): void {
    void this.router.navigate(['/book'], { queryParams: { pet: pet?.type, petId: pet?.id } });
  }
}
