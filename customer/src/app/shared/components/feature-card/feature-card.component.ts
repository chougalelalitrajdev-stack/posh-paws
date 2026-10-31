import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { Highlight } from '../../../core/models/catalog.model';

/** Icon tile + title + short description. Used for values, member perks and any feature list. */
@Component({
  selector: 'pp-feature-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feature-card.component.html',
  styleUrl: './feature-card.component.scss',
})
export class FeatureCardComponent {
  readonly item = input.required<Highlight>();
}
