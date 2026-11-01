import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';

/** "Showing 11–20 of 64" with Previous / Next. */
@Component({
  selector: 'pp-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  protected first = computed(() => (this.total() ? (this.page() - 1) * this.pageSize() + 1 : 0));
  protected last = computed(() => Math.min(this.page() * this.pageSize(), this.total()));
  protected hasNext = computed(() => this.last() < this.total());
}
