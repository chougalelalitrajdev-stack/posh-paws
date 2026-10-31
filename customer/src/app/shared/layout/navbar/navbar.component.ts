import {
  Component,
  HostListener,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
// Call/callback dialog parked for later use; Book buttons now open the slot-booking flow.
// import { BookingDialogService } from '../../../core/services/booking-dialog.service';
// import { ThemeSwitcherComponent } from '../theme-switcher/theme-switcher.component';

@Component({
  selector: 'pp-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive], // Add ThemeSwitcherComponent back when re-enabling the switcher.
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  // private bookingDialog = inject(BookingDialogService);
  private router = inject(Router);
  protected auth = inject(AuthService);

  protected scrolled = signal(false);
  protected menuOpen = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 20);
  }

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  startBooking(): void {
    // this.bookingDialog.open();
    void this.router.navigate(['/book']);
    this.closeMenu();
  }
}
