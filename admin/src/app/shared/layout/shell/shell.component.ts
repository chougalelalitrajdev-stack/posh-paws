import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../components/icon/icon.component';
import { NavListComponent } from '../nav-list/nav-list.component';
import { ProfileMenuComponent } from '../profile-menu/profile-menu.component';
import { MOBILE_TAB_PATHS, NAV_GROUPS, NavItem, SETTINGS_ITEM } from './nav.config';

/**
 * Signed-in layout: sidebar + top bar on desktop; header + bottom tab bar
 * (with a "More" sheet) below 992px. Pages render in the router outlet.
 */
@Component({
  selector: 'pp-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, NavListComponent, ProfileMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  host: { '(document:keydown.escape)': 'moreOpen.set(false)' },
})
export class ShellComponent {
  private auth = inject(AuthService);

  protected moreOpen = signal(false);

  /** Nav groups with the items this user's role may see. */
  protected groups = computed(() =>
    NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => this.canSee(i)) })).filter(g => g.items.length),
  );
  protected settings = computed(() => (this.canSee(SETTINGS_ITEM) ? SETTINGS_ITEM : null));
  protected tabs = computed(() =>
    MOBILE_TAB_PATHS.map(path => this.groups().flatMap(g => g.items).find(i => i.path === path)).filter((i): i is NavItem => !!i),
  );
  /** "More" sheet: every group minus the items already on the tab bar. */
  protected moreGroups = computed(() =>
    this.groups()
      .map(g => ({ ...g, items: g.items.filter(i => !MOBILE_TAB_PATHS.includes(i.path ?? '')) }))
      .filter(g => g.items.length),
  );

  private canSee(item: NavItem): boolean {
    return !item.roles || this.auth.hasRole(...item.roles);
  }
}
