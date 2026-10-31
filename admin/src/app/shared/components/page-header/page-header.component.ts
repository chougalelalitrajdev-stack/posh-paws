import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/**
 * Title row at the top of every page. Buttons go in with the ppActions attribute:
 *   <pp-page-header title="Customers" subtitle="...">
 *     <button ppActions class="pp-btn pp-btn-primary">Add customer</button>
 *   </pp-page-header>
 */
@Component({
  selector: 'pp-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
