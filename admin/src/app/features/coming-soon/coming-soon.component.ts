import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Stand-in for screens not built yet. `heading` and `phase` come from the route's data. */
@Component({
  selector: 'pp-coming-soon',
  imports: [PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss',
})
export class ComingSoonComponent {
  readonly heading = input.required<string>();
  readonly phase = input.required<string>();
}
