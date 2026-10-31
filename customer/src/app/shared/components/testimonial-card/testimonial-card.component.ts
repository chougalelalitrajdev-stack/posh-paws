import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { Testimonial } from '../../../core/models/catalog.model';

@Component({
  selector: 'pp-testimonial-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './testimonial-card.component.html',
  styleUrl: './testimonial-card.component.scss',
})
export class TestimonialCardComponent {
  readonly testimonial = input.required<Testimonial>();
}
