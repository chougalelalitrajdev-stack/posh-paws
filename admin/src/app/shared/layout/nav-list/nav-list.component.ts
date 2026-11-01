import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { NavGroup, NavItem } from '../shell/nav.config';

/** Grouped nav links on the dark green background. Used by the sidebar and the phone "More" sheet. */
@Component({
  selector: 'pp-nav-list',
  imports: [RouterLink, RouterLinkActive, NgTemplateOutlet, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nav-list.component.html',
  styleUrl: './nav-list.component.scss',
})
export class NavListComponent {
  readonly groups = input.required<NavGroup[]>();
  /** Pinned below the groups (Settings). */
  readonly footer = input<NavItem | null>(null);
  /** Live counts for items with a `badge` key. */
  readonly badges = input<Record<string, number>>({});
}
