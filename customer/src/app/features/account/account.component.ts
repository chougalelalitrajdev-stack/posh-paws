import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { PetDialogService } from '../../core/services/pet-dialog.service';
import { PetService } from '../../core/services/pet.service';
import { Pet } from '../../core/models/pet.model';
import { PET_EMOJI } from '../../core/constants/pet.constants';
import { petAgeLabel } from '../../core/utils/pet.utils';
// Call/callback dialog parked for later use; Book buttons now open the slot-booking flow.
// import { BookingDialogService } from '../../core/services/booking-dialog.service';
import { BookingService } from '../../core/services/booking.service';
import { Booking } from '../../core/models/booking.model';
import { dateLongLabel, timeLabel } from '../../core/utils/date.utils';

// ── Types ─────────────────────────────────────────────────────

interface QuickStat {
  value: string;
  label: string;
  icon: string;
}

// ── Static data ───────────────────────────────────────────────

const QUICK_STATS: QuickStat[] = [
  { value: '8',   label: 'Total bookings', icon: '📋' },
  { value: '3',   label: 'Sessions left',  icon: '🎟️' },
  { value: '10%', label: 'Member discount', icon: '🏷️' },
];

const MEMBERSHIP = {
  tier: 'Posh Plan 🌿',
  tagline: '5 sessions · Priority slots · 10% off',
  sessionsTotal: 5,
  sessionsUsed: 2,
};

// ─────────────────────────────────────────────────────────────

@Component({
  selector: 'pp-account',
  standalone: true,
  imports: [RouterLink, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  // private bookingDialog = inject(BookingDialogService);
  protected bookingService = inject(BookingService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private petDialog = inject(PetDialogService);
  protected petService = inject(PetService);
  protected readonly petEmoji = PET_EMOJI;
  protected readonly petAgeLabel = petAgeLabel;

  protected quickStats       = QUICK_STATS;
  protected membership       = MEMBERSHIP;

  protected userName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');

  // Progress bar width for membership sessions
  protected get sessionProgress(): string {
    const pct = (MEMBERSHIP.sessionsUsed / MEMBERSHIP.sessionsTotal) * 100;
    return `${pct}%`;
  }

  // Tab for bookings section
  protected activeTab = signal<'upcoming' | 'past'>('upcoming');

  setTab(tab: 'upcoming' | 'past'): void {
    this.activeTab.set(tab);
  }

  /** Booking whose Cancel was tapped once and now asks for confirmation. */
  protected confirmingCancel = signal<string | null>(null);
  protected cancelling = signal<string | null>(null);

  bookingMeta(b: Booking): string {
    return `${dateLongLabel(b.date)} · ${timeLabel(b.time)}`;
  }

  async cancelBooking(b: Booking): Promise<void> {
    if (this.confirmingCancel() !== b.id) {
      this.confirmingCancel.set(b.id);
      return;
    }
    this.cancelling.set(b.id);
    try {
      await this.bookingService.cancel(b.id);
    } finally {
      this.cancelling.set(null);
      this.confirmingCancel.set(null);
    }
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
    // this.bookingDialog.open();
    void this.router.navigate(['/book'], { queryParams: { pet: pet?.type, petId: pet?.id } });
  }
}
