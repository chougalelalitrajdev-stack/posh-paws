import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';

/** Small on/off switch between 2–4 views (List | Calendar, Day | Week, Dogs | Cats). */
@Component({
  selector: 'pp-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segmented.component.html',
  styleUrl: './segmented.component.scss',
})
export class SegmentedComponent {
  readonly options = input.required<{ value: string; label: string }[]>();
  readonly label = input.required<string>();
  readonly value = model.required<string>();
}
