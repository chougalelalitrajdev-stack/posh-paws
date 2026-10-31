import { Component, ChangeDetectionStrategy, ViewEncapsulation, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Eyebrow + title (+ optional intro) for a page section.
 * Slots: [ppTitle] heading text, [ppAside] control on the right (e.g. tabs), default slot = intro text.
 * `linkTo` adds a "See all" style link beside the title on phones only.
 */
@Component({
  selector: 'pp-section-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Unencapsulated so styles reach the headings projected from the page. Classes are pp- prefixed.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './section-header.component.html',
  styleUrl: './section-header.component.scss',
})
export class SectionHeaderComponent {
  readonly eyebrow = input.required<string>();
  /** `center` centres the header from tablet up (phones are always left-aligned). */
  readonly align = input<'start' | 'center'>('start');
  readonly tone = input<'light' | 'dark'>('light');
  /** Show the [ppAside] slot on every screen, or only from desktop (lg) up. */
  readonly asideFrom = input<'always' | 'lg'>('always');
  readonly linkTo = input<string>();
  readonly linkLabel = input('See all →');
}
