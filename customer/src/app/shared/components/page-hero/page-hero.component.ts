import { Component, ChangeDetectionStrategy, ViewEncapsulation, input } from '@angular/core';

/**
 * Top-of-page hero. Content slots (all optional except the title):
 *   [ppTitle]   headline (use <span> per line and <em> for the accent word)
 *   [ppLead]    intro text
 *   [ppActions] buttons
 *   [ppVisual]  right-hand picture (desktop only, split layout)
 *   [ppFooter]  extra row below the copy, e.g. a stats strip
 */
@Component({
  selector: 'pp-page-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Unencapsulated so styles reach the headings projected from the page. Classes are pp- prefixed.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './page-hero.component.html',
  styleUrl: './page-hero.component.scss',
})
export class PageHeroComponent {
  readonly eyebrow = input.required<string>();
  /** `split` puts the copy left and a picture right on desktop; `center` centres the copy from tablet up. */
  readonly layout = input<'center' | 'split'>('center');
  readonly tone = input<'light' | 'dark'>('light');
}
