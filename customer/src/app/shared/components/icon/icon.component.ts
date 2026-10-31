import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { ICON_PATHS, IconName } from './icons';

/** Decorative SVG icon that inherits the surrounding text colour. Label the parent control, not the icon. */
@Component({
  selector: 'pp-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; flex-shrink: 0; }`,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(24);

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
}
