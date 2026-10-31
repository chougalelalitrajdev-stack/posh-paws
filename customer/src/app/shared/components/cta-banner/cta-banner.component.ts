import { Component, ChangeDetectionStrategy, ViewEncapsulation, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Full-width "ready to book?" banner.
 * Slots: [ppTitle] headline (use <em> for the accent), [ppText] supporting line, [ppAction] the button.
 */
@Component({
  selector: 'pp-cta-banner',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Unencapsulated so styles reach the headings projected from the page. Classes are pp- prefixed.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './cta-banner.component.html',
  styleUrl: './cta-banner.component.scss',
})
export class CtaBannerComponent {
  readonly eyebrow = input.required<string>();
  /** Section background behind the card. */
  readonly surface = input<'page' | 'tinted'>('page');
}
