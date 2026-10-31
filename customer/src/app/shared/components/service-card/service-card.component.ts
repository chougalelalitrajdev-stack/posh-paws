import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { ServiceItem } from '../../../core/models/catalog.model';
import { DurationPipe } from '../../pipes/duration.pipe';
import { InrPipe } from '../../pipes/inr.pipe';

/**
 * One grooming service. `layout="list"` is the compact row used on the Services page
 * on phones; on tablet and up both layouts look the same.
 * Set `showBook` to add a Book button that emits `book`.
 */
@Component({
  selector: 'pp-service-card',
  imports: [InrPipe, DurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-card.component.html',
  styleUrl: './service-card.component.scss',
})
export class ServiceCardComponent {
  readonly service = input.required<ServiceItem>();
  readonly layout = input<'card' | 'list'>('card');
  readonly showBook = input(false);
  readonly book = output<ServiceItem>();
}
