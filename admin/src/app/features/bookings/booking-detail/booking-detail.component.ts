import { Component, ChangeDetectionStrategy, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VACCINATION } from '../../../core/constants/pet.constants';
import { SOURCES } from '../../../core/constants/status.constants';
import { ActivityEntry, Booking } from '../../../core/models/booking.model';
import { Customer } from '../../../core/models/customer.model';
import { AlertService } from '../../../core/services/alert.service';
import { BookingService } from '../../../core/services/booking.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { TemplateService } from '../../../core/services/template.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { CustomerService } from '../../../core/services/customer.service';
import { SettingsService } from '../../../core/services/settings.service';
import { formatPhone, telLink, whatsappLink } from '../../../core/utils/contact.utils';
import { formatDuration, minutesSince, petAge, shortDate, slotStart, timeRange, untilLabel, whenLabel } from '../../../core/utils/date.utils';
import { formatInr } from '../../../core/utils/money.utils';
import { firstName } from '../../../core/utils/message.utils';
import { ActivityListComponent } from '../../../shared/components/activity-list/activity-list.component';
import { BillComponent } from '../../../shared/components/bill/bill.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { BookingProgressComponent, ProgressStep } from '../booking-progress/booking-progress.component';
import { RecordPaymentComponent } from '../record-payment/record-payment.component';
import { RescheduleComponent } from '../reschedule/reschedule.component';

/** One booking: progress, payment, appointment, pet, customer and activity (design: "Booking detail"). */
@Component({
  selector: 'pp-booking-detail',
  imports: [
    RouterLink, PageHeaderComponent, StatusPillComponent, RescheduleComponent, RecordPaymentComponent, BookingProgressComponent, BillComponent, InrPipe,
    ActivityListComponent, AvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-detail.component.html',
  styleUrl: './booking-detail.component.scss',
})
export class BookingDetailComponent {
  private bookingService = inject(BookingService);
  private customerService = inject(CustomerService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  protected catalog = inject(CatalogService);
  private templates = inject(TemplateService);
  private settings = inject(SettingsService);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly useMocks = environment.useMocks;
  protected readonly sources = SOURCES;
  protected readonly vaccination = VACCINATION;
  protected readonly formatPhone = formatPhone;
  protected readonly telLink = telLink;
  protected readonly whenLabel = whenLabel;
  protected readonly shortDate = shortDate;
  protected readonly whatsappLink = whatsappLink;
  protected readonly petAge = petAge;

  protected booking = signal<Booking | null>(null);
  protected customer = signal<Customer | null>(null);
  protected busy = signal(false);
  protected rescheduling = signal(false);
  /** Record payment dialog: a payment only, or checkout (payment + completed). */
  protected recording = signal<'payment' | 'checkout' | null>(null);
  protected note = signal('');

  protected title = computed(() => {
    const b = this.booking();
    if (!b) return 'Booking';
    if (b.pet && b.service) return `${b.pet.name}'s ${b.service.name}`;
    return `Booking for ${b.customer.name}`;
  });

  protected meta = computed(() => {
    const b = this.booking();
    if (!b) return '';
    const parts = [b.id];
    if (b.date && b.time && b.service) parts.push(`${shortDate(b.date)}, ${timeRange(b.time, b.service.durationMinutes)}`);
    if (b.stationId) parts.push(this.catalog.stationName(b.stationId));
    return parts.join(' · ');
  });

  protected whenText = computed(() => {
    const b = this.booking();
    if (!b) return '';
    if (b.date && b.time && b.service) return `${shortDate(b.date)}, ${timeRange(b.time, b.service.durationMinutes)}`;
    return 'Not picked yet';
  });

  /** Booked → Details → (Link sent) → Confirmed → Completed → Paid in full, with the time each happened. */
  protected progress = computed<ProgressStep[]>(() => {
    const b = this.booking();
    if (!b) return [];
    const first = (kind: ActivityEntry['kind'], title?: string) =>
      [...b.activity].reverse().find(a => a.kind === kind && (!title || a.title === title))?.at;
    const confirmedAt = ['confirmed', 'completed', 'no_show'].includes(b.stage)
      ? first('status', 'Booking confirmed') ?? b.payments.find(p => p.kind === 'advance')?.at ?? b.createdAt
      : undefined;
    const linkSent = first('payment', 'Payment link sent on WhatsApp');
    const steps = [
      { label: 'Booked', at: b.createdAt },
      { label: 'Details', at: first('details') ?? (b.bill ? b.createdAt : undefined) },
      // Only bookings that went through a payment link show that step.
      ...(linkSent || b.paymentLink ? [{ label: 'Link sent', at: linkSent ?? b.paymentLink?.sentAt }] : []),
      { label: 'Confirmed', at: confirmedAt },
      { label: 'Completed', at: b.stage === 'completed' ? first('status', 'Marked completed') ?? b.date ?? undefined : undefined },
      { label: 'Paid in full', at: b.paymentStatus === 'paid' && b.bill?.totalPaise ? b.payments.at(-1)?.at : undefined },
    ];
    const current = steps.findIndex(s => !s.at);
    return steps.map((s, i) => ({
      label: s.label,
      state: (current === -1 || i < current ? 'done' : i === current ? 'now' : 'later') as ProgressStep['state'],
      time: s.at ? whenLabel(s.at) : i === current && this.isOpen() ? 'Waiting' : '—',
    }));
  });

  protected isOpen = computed(() => ['draft', 'awaiting_payment', 'confirmed'].includes(this.booking()?.stage ?? ''));
  protected hasStarted = computed(() => {
    const b = this.booking();
    return !!b?.date && !!b.time && slotStart(b.date, b.time) <= new Date();
  });

  /** The open payment link, if any. */
  protected linkText = computed(() => {
    const b = this.booking();
    const l = b?.paymentLink;
    if (!b || !l) return null;
    const beforeVisit = b.stage === 'awaiting_payment';
    return {
      amount: formatInr(l.amountPaise),
      amountNote: beforeVisit ? (l.amountType === 'hold' ? 'Advance · holds the slot' : 'Full amount · holds the slot') : 'Balance',
      sent: whenLabel(l.sentAt),
      expires: l.failed ? 'Payment failed' : minutesSince(l.expiresAt) > 0 ? 'Expired' : `In ${untilLabel(l.expiresAt)}`,
      expiresNote: beforeVisit ? 'Slot is held until then' : 'Or pay at the shop',
    };
  });
  /** Money can be taken until the booking is closed. */
  protected canTakePayment = computed(() => {
    const b = this.booking();
    return !!b?.bill?.balancePaise && ['awaiting_payment', 'confirmed', 'completed'].includes(b.stage);
  });

  protected whatsappHref = computed(() => {
    const b = this.booking();
    const link = b?.paymentLink;
    if (!b || !link || !b.pet || !b.service || !b.date || !b.time) return '';
    const hours = Math.round((new Date(link.expiresAt).getTime() - new Date(link.sentAt).getTime()) / 3_600_000);
    return whatsappLink(b.customer.phone, this.templates.render('payment_link', {
      customer_name: firstName(b.customer.name), pet_name: b.pet.name, service: b.service.name, date_time: `${shortDate(b.date)} · ${b.time}`,
      amount: formatInr(link.amountPaise), payment_link: link.url, link_hours: String(hours),
    }));
  });

  protected petInfo = computed(() => {
    const id = this.booking()?.pet?.id;
    return this.customer()?.pets.find(p => p.id === id) ?? null;
  });

  constructor() {
    this.catalog.load().subscribe();
    this.templates.load().subscribe();
    this.settings.load().subscribe();
    // Opening another booking cancels the previous one's requests (switchMap).
    toObservable(this.id).pipe(
      tap(() => this.booking.set(null)),
      switchMap(id => this.bookingService.get(id).pipe(
        tap(b => this.booking.set(b)),
        switchMap(b => this.customerService.get(b.customer.id)),
        catchError(() => of(null)),
      )),
      takeUntilDestroyed(),
    ).subscribe(customer => this.customer.set(customer));
  }

  protected durationText(): string {
    return formatDuration(this.booking()?.service?.durationMinutes ?? 0);
  }

  resendLink(): void {
    this.run(b => this.bookingService.sendPaymentLink(b.id, b.paymentLink?.amountType ?? 'full'), 'New payment link created. Send it on WhatsApp.');
  }

  /** A link for the balance, for customers who'd rather pay online than at the shop. */
  sendBalanceLink(): void {
    this.run(b => this.bookingService.sendPaymentLink(b.id, 'full'), 'Balance link created. Send it on WhatsApp.');
  }

  onPaymentRecorded(b: Booking): void {
    const checkedOut = b.stage === 'completed' && this.booking()?.stage !== 'completed';
    this.booking.set(b);
    this.recording.set(null);
    const due = b.bill?.balancePaise ? `${formatInr(b.bill.balancePaise)} still due.` : '';
    this.alert.success(checkedOut ? `Payment recorded and visit completed.${due ? ` ${due}` : ''}` : `Payment recorded. ${due || 'Paid in full.'}`);
  }

  async copyLink(): Promise<void> {
    const link = this.booking()?.paymentLink?.url;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.alert.success('Payment link copied.');
    } catch {
      this.alert.error('Could not copy. Select the link and copy it instead.');
    }
  }

  simulatePayment(): void {
    this.run(x => this.bookingService.simulateOnlinePayment(x.id), 'Customer paid online (demo). Booking confirmed.');
  }

  async cancel(): Promise<void> {
    const b = this.booking();
    if (!b) return;
    const ok = await this.confirm.ask({
      title: 'Cancel this booking?',
      message: this.cancelMessage(b),
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (ok) this.run(x => this.bookingService.cancel(x.id), 'Booking cancelled.');
  }

  /** What happens to the money, by the refund rule (root CLAUDE.md › Booking & payment rules). */
  private cancelMessage(b: Booking): string {
    const parts = ['The slot is freed.'];
    if (b.bill?.discount?.kind === 'session') parts.push('The plan session is given back.');
    const advance = b.payments.filter(p => p.kind === 'advance' && p.method === 'online' && !b.payments.some(r => r.refundOf === p.id)).reduce((sum, p) => sum + p.amountPaise, 0);
    if (advance) {
      const hours = this.settings.settings()?.payments.freeCancellationHours ?? 24;
      const early = !b.date || !b.time || slotStart(b.date, b.time).getTime() - Date.now() >= hours * 3_600_000;
      parts.push(early ? `The ${formatInr(advance)} advance is refunded automatically.` : `The ${formatInr(advance)} advance is kept (less than ${hours} h before the slot).`);
    }
    if (b.payments.some(p => p.kind === 'balance' && !b.payments.some(r => r.refundOf === p.id))) parts.push('Other payments aren’t refunded automatically; a Super Admin refunds them from Payments.');
    if (b.paymentLink) parts.push('The payment link stops working.');
    return parts.join(' ');
  }

  complete(): void {
    this.run(x => this.bookingService.complete(x.id), 'Marked completed.');
  }

  async noShow(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Mark as no-show?',
      message: 'Use this when the pet didn’t come. The advance and any plan session are kept, and nothing more is owed.',
      confirmLabel: 'Mark no-show', tone: 'danger',
    });
    if (ok) this.run(x => this.bookingService.markNoShow(x.id), 'Marked as no-show.');
  }

  saveNote(): void {
    const text = this.note().trim();
    if (!text) return;
    this.run(x => this.bookingService.addNote(x.id, text), 'Note added.', () => this.note.set(''));
  }

  onRescheduled(b: Booking): void {
    this.booking.set(b);
    this.rescheduling.set(false);
    this.alert.success(`Moved to ${shortDate(b.date!)} at ${b.time}.`);
  }

  onNoteInput(e: Event): void {
    this.note.set((e.target as HTMLTextAreaElement).value);
  }

  /** Runs one action on the booking and shows the updated booking. Errors are toasted by the interceptor. */
  private run(action: (b: Booking) => Observable<Booking>, success?: string, done?: () => void): void {
    const b = this.booking();
    if (!b || this.busy()) return;
    this.busy.set(true);
    action(b).pipe(finalize(() => this.busy.set(false))).subscribe(updated => {
      this.booking.set(updated);
      if (success) this.alert.success(success);
      done?.();
    });
  }
}
