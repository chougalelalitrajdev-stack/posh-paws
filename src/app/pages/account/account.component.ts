import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { PetDialogService } from '../../core/pets/pet-dialog.service';
import { PetsService } from '../../core/pets/pets.service';
import { Pet } from '../../core/pets/pet.models';
import { PET_EMOJI } from '../../core/pets/pet.options';
import { petAgeLabel } from '../../core/pets/pet.utils';
import { BookingDialogService } from '../../core/services/booking-dialog.service';

// ── Types ─────────────────────────────────────────────────────

type BookingStatus = 'confirmed' | 'pending' | 'completed';

interface Booking {
  icon: string;
  label: string;
  meta: string;
  status: BookingStatus;
}

interface QuickStat {
  value: string;
  label: string;
  icon: string;
}

// ── Static data ───────────────────────────────────────────────

const UPCOMING_BOOKINGS: Booking[] = [
  { icon: '🐶', label: 'Royal Package — Bruno',    meta: 'Friday, 9 May 2025 · 11:30 AM',       status: 'confirmed' },
  { icon: '🐱', label: 'Signature Bath — Luna',    meta: 'Monday, 19 May 2025 · 2:00 PM',        status: 'pending'   },
];

const PAST_BOOKINGS: Booking[] = [
  { icon: '🐶', label: 'Full Groom & Style — Bruno', meta: 'Wednesday, 2 April 2025 · 10:00 AM', status: 'completed' },
  { icon: '🐱', label: 'Nail Trim — Luna',            meta: 'Saturday, 15 March 2025 · 3:00 PM', status: 'completed' },
  { icon: '🐶', label: 'De-shedding Treatment — Bruno', meta: 'Monday, 3 Feb 2025 · 9:30 AM',   status: 'completed' },
];

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
  private bookingDialog = inject(BookingDialogService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private petDialog = inject(PetDialogService);
  protected petsService = inject(PetsService);
  protected readonly petEmoji = PET_EMOJI;
  protected readonly petAgeLabel = petAgeLabel;

  protected upcomingBookings = UPCOMING_BOOKINGS;
  protected pastBookings     = PAST_BOOKINGS;
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

  openBookingDialog(): void {
    this.bookingDialog.open();
  }
}
