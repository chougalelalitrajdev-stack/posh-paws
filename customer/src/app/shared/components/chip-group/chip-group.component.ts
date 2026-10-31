import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/** Tap-to-select chips. Single-select binds `value`; with `multiple`, bind `values`. */
@Component({
  selector: 'pp-chip-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chip-group.component.html',
  styleUrl: './chip-group.component.scss',
})
export class ChipGroupComponent<T extends string> {
  readonly options = input.required<ChipOption<T>[]>();
  readonly multiple = input(false);
  readonly value = model<T | null>(null);
  readonly values = model<T[]>([]);

  protected isSelected(option: T): boolean {
    return this.multiple() ? this.values().includes(option) : this.value() === option;
  }

  protected toggle(option: T): void {
    if (this.multiple()) {
      this.values.update(list => (list.includes(option) ? list.filter(v => v !== option) : [...list, option]));
    } else {
      this.value.set(this.value() === option ? null : option);
    }
  }
}
