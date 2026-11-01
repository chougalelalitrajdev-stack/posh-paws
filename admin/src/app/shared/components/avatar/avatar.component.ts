import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { initials } from '../../../core/utils/contact.utils';

/** Initials in a circle for a person. Decorative: put the name next to it. */
@Component({
  selector: 'pp-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  host: { '[class]': "'is-' + size()" },
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  protected letters = computed(() => initials(this.name()));
}
