import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { ICON_PATHS, IconName } from './icons';

/** Decorative SVG icon that inherits the surrounding text colour. Label the parent control, not the icon. */
@Component({
  selector: 'pp-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
}
