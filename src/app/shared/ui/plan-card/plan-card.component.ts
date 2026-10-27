import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { PlanItem } from '../../../core/catalog/catalog.models';
import { IconComponent } from '../icon/icon.component';
import { InrPipe } from '../pipes/inr.pipe';

/** One membership plan with its feature list and a Subscribe button that emits `subscribe`. */
@Component({
  selector: 'pp-plan-card',
  imports: [InrPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-card.component.html',
  styleUrl: './plan-card.component.scss',
})
export class PlanCardComponent {
  readonly plan = input.required<PlanItem>();
  readonly subscribe = output<PlanItem>();
}
