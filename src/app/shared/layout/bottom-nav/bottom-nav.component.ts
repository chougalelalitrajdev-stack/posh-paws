import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact: boolean;
}

@Component({
  selector: 'pp-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {
  private auth = inject(AuthService);

  protected items = computed<NavItem[]>(() => [
    { path: '/',           label: 'Home',       icon: '🏠', exact: true  },
    { path: '/services',   label: 'Services',   icon: '🛁', exact: false },
    { path: '/membership', label: 'Membership', icon: '🏷️', exact: false },
    { path: '/account',    label: this.auth.isLoggedIn() ? 'Account' : 'Log in', icon: '👤', exact: false },
  ]);
}
