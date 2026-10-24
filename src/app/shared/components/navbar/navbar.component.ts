import {
  Component,
  HostListener,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeSwitcherComponent } from '../theme-switcher/theme-switcher.component';

@Component({
  selector: 'pp-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
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
}
