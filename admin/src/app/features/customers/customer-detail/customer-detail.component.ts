import { Component, ChangeDetectionStrategy, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, forkJoin, of, switchMap, tap } from 'rxjs';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivityEntry, Booking } from '../../../core/models/booking.model';
import { Customer, CustomerPet } from '../../../core/models/customer.model';
import { Payment } from '../../../core/models/payment.model';
import { PLAN_CHANGE_ROLES } from '../../../core/constants/app.constants';
import { PAYMENT_STATES } from '../../../core/constants/status.constants';
import { AlertService } from '../../../core/services/alert.service';
import { BookingService } from '../../../core/services/booking.service';
import { CustomerService } from '../../../core/services/customer.service';
import { formatPhone, telLink, whatsappLink } from '../../../core/utils/contact.utils';
import { monthYear, petAge, shortDate, whenLabel } from '../../../core/utils/date.utils';
import { formatInr } from '../../../core/utils/money.utils';
import { ActivityListComponent } from '../../../shared/components/activity-list/activity-list.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs/filter-tabs.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { StatComponent } from '../../../shared/components/stat/stat.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { PetDialogComponent } from '../../pets/pet-dialog/pet-dialog.component';
import { ChangePlanComponent } from '../../subscriptions/change-plan/change-plan.component';
import { CustomerDialogComponent } from '../customer-dialog/customer-dialog.component';

type Tab = 'overview' | 'pets' | 'bookings' | 'payments' | 'activity';

/** One customer on one page: contact, pets, plan, bookings, payments and notes (design: "Customer profile"). */
@Component({
  selector: 'pp-customer-detail',
  imports: [
    RouterLink, NgbDropdownModule, AvatarComponent, StatComponent, FilterTabsComponent, StatusPillComponent,
    IconComponent, HasRoleDirective, InrPipe, CustomerDialogComponent, PetDialogComponent, ActivityListComponent, ChangePlanComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.scss',
})
export class CustomerDetailComponent {
  private customerService = inject(CustomerService);
  private bookingService = inject(BookingService);
  private alert = inject(AlertService);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly formatPhone = formatPhone;
  protected readonly telLink = telLink;
  protected readonly whatsappLink = whatsappLink;
  protected readonly shortDate = shortDate;
  protected readonly monthYear = monthYear;
  protected readonly whenLabel = whenLabel;
  protected readonly planChangers = PLAN_CHANGE_ROLES;

  protected customer = signal<Customer | null>(null);
  protected bookings = signal<Booking[]>([]);
  protected payments = signal<Payment[] | null>(null);
  protected readonly paymentStates = PAYMENT_STATES;
  protected activity = signal<ActivityEntry[] | null>(null);
  protected tab = signal<Tab>('overview');
  protected editing = signal(false);
  /** Pet dialog: undefined = closed, null = add, a pet = edit. */
  protected petDialog = signal<CustomerPet | null | undefined>(undefined);
  protected noteDraft = signal<string | null>(null);
  protected savingNote = signal(false);
  protected changingPlan = signal(false);

  protected owner = computed(() => {
    const c = this.customer();
    return c ? { id: c.id, name: c.name, phone: c.phone } : null;
  });

  protected tabs = computed(() => [
    { key: 'overview', label: 'Overview' },
    { key: 'pets', label: `Pets · ${this.customer()?.pets.length ?? 0}` },
    { key: 'bookings', label: `Bookings · ${this.bookings().length}` },
    { key: 'payments', label: 'Payments' },
    { key: 'activity', label: 'Activity' },
  ]);

  protected facts = computed(() => {
    const c = this.customer();
    if (!c) return [];
    const plan = c.plan;
    return [
      { label: 'Bookings', value: c.bookingsCount, sub: `${c.pastBookings} past visit${c.pastBookings === 1 ? '' : 's'}` },
      { label: 'Spent', value: formatInr(c.spentPaise), sub: `Since ${monthYear(c.customerSince)}` },
      { label: 'Last visit', value: c.lastVisit ? shortDate(c.lastVisit.date) : '—', sub: c.lastVisit ? `${c.lastVisit.serviceName} · ${c.lastVisit.petName}` : 'No visits yet' },
      {
        label: 'Plan', value: plan?.name ?? 'No plan',
        sub: plan ? `${plan.sessionsLeft === null ? 'Unlimited sessions' : `${plan.sessionsLeft} sessions left`}${plan.renewsOn ? ` · renews ${shortDate(plan.renewsOn)}` : ''}` : 'Not a member',
      },
    ];
  });

  protected planUsage = computed(() => {
    const plan = this.customer()?.plan;
    if (!plan || plan.sessionsTotal === null || plan.sessionsLeft === null) return null;
    const used = plan.sessionsTotal - plan.sessionsLeft;
    return { used, total: plan.sessionsTotal, width: `${(used / plan.sessionsTotal) * 100}%` };
  });

  /** The open customer and tab; Payments and Activity load the first time their tab opens. */
  private lazyTab = computed(() => ({ id: this.customer()?.id ?? null, tab: this.tab() }), {
    equal: (a, b) => a.id === b.id && a.tab === b.tab,
  });

  constructor() {
    // Opening another customer cancels the previous one's requests (switchMap).
    toObservable(this.id).pipe(
      tap(() => {
        this.customer.set(null);
        this.payments.set(null);
        this.activity.set(null);
        this.tab.set('overview');
      }),
      switchMap(id => forkJoin({
        customer: this.customerService.get(id),
        bookings: this.bookingService.list({ customerId: id, pageSize: 200 }),
      }).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(result => {
      if (!result) return;
      this.customer.set(result.customer);
      this.bookings.set(result.bookings.items);
    });

    toObservable(this.lazyTab).pipe(
      switchMap(({ id, tab }) => {
        if (id && tab === 'payments' && !this.payments()) return this.customerService.payments(id).pipe(tap(p => this.payments.set(p)), catchError(() => EMPTY));
        if (id && tab === 'activity' && !this.activity()) return this.customerService.activity(id).pipe(tap(a => this.activity.set(a)), catchError(() => EMPTY));
        return EMPTY;
      }),
      takeUntilDestroyed(),
    ).subscribe();
  }

  protected petLine(p: CustomerPet): string {
    return [p.breed ?? (p.type === 'dog' ? 'Dog' : 'Cat'), petAge(p.birthDate), p.gender, p.weightKg ? `${p.weightKg} kg` : ''].filter(Boolean).join(' · ');
  }

  protected lastGroom(p: CustomerPet): string {
    const b = this.bookings().find(x => x.pet?.id === p.id && x.stage === 'completed' && x.date);
    return b ? `${shortDate(b.date!)} · ${b.service?.name}` : 'Not groomed yet';
  }

  protected bookingWhen(b: Booking): string {
    if (b.date && b.time) return `${shortDate(b.date)} · ${b.time}`;
    return 'No slot yet';
  }

  setTab(key: string): void {
    this.tab.set(key as Tab);
  }

  onSaved(c: Customer): void {
    this.customer.set(c);
    this.editing.set(false);
    this.alert.success('Customer details saved.');
  }

  onPetSaved(): void {
    const wasEditing = !!this.petDialog();
    this.petDialog.set(undefined);
    this.customerService.get(this.id()).subscribe(c => {
      this.customer.set(c);
      this.alert.success(wasEditing ? 'Pet saved.' : 'Pet added.');
    });
  }

  onPlanChanged(): void {
    this.changingPlan.set(false);
    // Plan, payments and activity all change; Payments and Activity load again when opened.
    this.payments.set(null);
    this.activity.set(null);
    this.customerService.get(this.id()).subscribe(c => this.customer.set(c));
  }

  saveNote(): void {
    const text = this.noteDraft();
    if (text === null) return;
    this.savingNote.set(true);
    this.customerService.saveNote(this.id(), text).pipe(finalize(() => this.savingNote.set(false))).subscribe(c => {
      this.customer.set(c);
      this.noteDraft.set(null);
    });
  }

  onNoteInput(e: Event): void {
    this.noteDraft.set((e.target as HTMLTextAreaElement).value);
  }

}
