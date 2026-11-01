import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/** A figure in a card: small label, big value, one line of context. */
@Component({
  selector: 'pp-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stat.component.html',
  styleUrl: './stat.component.scss',
})
export class StatComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input('');
}
