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
import { formatPhone, telLink, whatsappLink } from '../../../core/utils/contact.utils';
import { formatDuration, minutesSince, petAge, shortDate, slotStart, timeRange, untilLabel, whenLabel } from '../../../core/utils/date.utils';
import { formatInr } from '../../../core/utils/money.utils';
import { firstName } from '../../../core/utils/message.utils';
import { ActivityListComponent } from '../../../shared/components/activity-list/activity-list.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { BookingProgressComponent, ProgressStep } from '../booking-progress/booking-progress.component';
import { RescheduleComponent } from '../reschedule/reschedule.component';

/** One booking: progress, payment, appointment, pet, customer and activity (design: "Booking detail"). */
@Component({
  selector: 'pp-booking-detail',
  imports: [RouterLink, PageHeaderComponent, StatusPillComponent, RescheduleComponent, BookingProgressComponent, InrPipe, ActivityListComponent, AvatarComponent],
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
  protected note = signal('');

  protected title = computed(() => {
    const b = this.booking();
    if (!b) return 'Booking';
    if (b.pet && b.service) return `${b.pet.name}'s ${b.service.name}`;
    return `Request from ${b.customer.name}`;
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
    return b.request?.bestTime ? `Wants: ${b.request.bestTime}` : 'Not picked yet';
  });

  /** Request → Details → Link sent → Paid → Confirmed → Completed, with the time each happened. */
  protected progress = computed<ProgressStep[]>(() => {
    const b = this.booking();
    if (!b) return [];
    const first = (kind: ActivityEntry['kind'], title?: string) =>
      [...b.activity].reverse().find(a => a.kind === kind && (!title || a.title === title))?.at;
    const steps = [
      { label: b.request ? 'Request' : 'Booked', at: b.createdAt },
      { label: 'Details', at: first('details') ?? (b.payment ? b.createdAt : undefined) },
      { label: 'Link sent', at: b.payment?.sentAt },
      { label: 'Paid', at: b.payment?.paidAt },
      { label: 'Confirmed', at: b.payment?.paidAt },
      { label: 'Completed', at: b.stage === 'completed' ? first('status', 'Marked completed') ?? b.date ?? undefined : undefined },
    ];
    const current = steps.findIndex(s => !s.at);
    return steps.map((s, i) => ({
      label: s.label,
      state: (current === -1 || i < current ? 'done' : i === current ? 'now' : 'later') as ProgressStep['state'],
      time: s.at ? whenLabel(s.at) : i === current && this.isOpen() ? 'Waiting' : '—',
    }));
  });

  protected isOpen = computed(() => ['request', 'draft', 'awaiting_payment', 'confirmed'].includes(this.booking()?.stage ?? ''));
  protected hasStarted = computed(() => {
    const b = this.booking();
    return !!b?.date && !!b.time && slotStart(b.date, b.time) <= new Date();
  });

  protected paymentText = computed(() => {
    const b = this.booking();
    const p = b?.payment;
    if (!b || !p) return null;
    const balance = (b.pricePaise ?? 0) - p.amountPaise;
    const plan = this.customer()?.plan;
    return {
      amount: formatInr(p.amountPaise),
      amountNote: p.amountType === 'hold'
        ? `Slot hold · ${formatInr(balance)} at the visit`
        : `Full amount · ${plan ? `${plan.name} member price` : 'no plan'}`,
      sent: whenLabel(p.sentAt),
      expires: p.paidAt
        ? `Paid ${whenLabel(p.paidAt)}${p.method === 'desk' ? ' at the desk' : ' online'}`
        : minutesSince(p.expiresAt) > 0 ? 'Expired' : `In ${untilLabel(p.expiresAt)}`,
      expiresLabel: p.paidAt ? 'Paid' : 'Link expires',
      expiresNote: p.paidAt ? 'Booking confirmed' : 'Slot is held until then',
    };
  });

  protected whatsappHref = computed(() => {
    const b = this.booking();
    if (!b?.payment || !b.pet || !b.service || !b.date || !b.time) return '';
    const hours = Math.round((new Date(b.payment.expiresAt).getTime() - new Date(b.payment.sentAt).getTime()) / 3_600_000);
    return whatsappLink(b.customer.phone, this.templates.render('payment_link', {
      customer_name: firstName(b.customer.name), pet_name: b.pet.name, service: b.service.name, date_time: `${shortDate(b.date)} · ${b.time}`,
      amount: formatInr(b.payment.amountPaise), payment_link: b.payment.link, link_hours: String(hours),
    }));
  });

  protected petInfo = computed(() => {
    const id = this.booking()?.pet?.id;
    return this.customer()?.pets.find(p => p.id === id) ?? null;
  });

  constructor() {
    this.catalog.load().subscribe();
    this.templates.load().subscribe();
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
    this.run(b => this.bookingService.sendPaymentLink(b.id, b.payment?.amountType ?? 'full'), 'New payment link created. Send it on WhatsApp.');
  }

  async copyLink(): Promise<void> {
    const link = this.booking()?.payment?.link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.alert.success('Payment link copied.');
    } catch {
      this.alert.error('Could not copy. Select the link and copy it instead.');
    }
  }

  async markPaid(): Promise<void> {
    const b = this.booking();
    if (!b?.payment) return;
    const ok = await this.confirm.ask({
      title: 'Mark as paid at the desk?',
      message: `${formatInr(b.payment.amountPaise)} received from ${b.customer.name}. The booking will be confirmed.`,
      confirmLabel: 'Mark paid',
    });
    if (ok) this.run(x => this.bookingService.markPaid(x.id), 'Marked paid. Booking confirmed.');
  }

  simulatePayment(): void {
    this.run(x => this.bookingService.simulateOnlinePayment(x.id), 'Customer paid online (demo). Booking confirmed.');
  }

  async cancel(): Promise<void> {
    const b = this.booking();
    if (!b) return;
    const paid = b.paymentStatus === 'paid';
    const ok = await this.confirm.ask({
      title: b.stage === 'request' ? 'Cancel this request?' : 'Cancel this booking?',
      message: paid
        ? 'The slot is freed. The payment is not refunded automatically; a Super Admin refunds it from Payments.'
        : 'The slot is freed and the payment link stops working.',
      confirmLabel: b.stage === 'request' ? 'Cancel request' : 'Cancel booking',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (ok) this.run(x => this.bookingService.cancel(x.id), 'Booking cancelled.');
  }

  complete(): void {
    this.run(x => this.bookingService.complete(x.id), 'Marked completed.');
  }

  async noShow(): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Mark as no-show?', message: 'Use this when the customer didn’t come.', confirmLabel: 'Mark no-show', tone: 'danger' });
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
