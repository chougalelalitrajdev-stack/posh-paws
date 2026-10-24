import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';

// ── Types ─────────────────────────────────────────────────────

type BookingStatus = 'confirmed' | 'pending' | 'completed';

interface Booking {
  icon: string;
  label: string;
  meta: string;
  status: BookingStatus;
}

interface Pet {
  icon: string;
  name: string;
  breed: string;
  age: string;
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

const PETS: Pet[] = [
  { icon: '🐶', name: 'Bruno', breed: 'Golden Retriever', age: '3 yrs' },
  { icon: '🐱', name: 'Luna',  breed: 'Persian Cat',      age: '2 yrs' },
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
  protected upcomingBookings = UPCOMING_BOOKINGS;
  protected pastBookings     = PAST_BOOKINGS;
  protected pets             = PETS;
  protected quickStats       = QUICK_STATS;
  protected membership       = MEMBERSHIP;

  protected userName = 'Priya';

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
}
