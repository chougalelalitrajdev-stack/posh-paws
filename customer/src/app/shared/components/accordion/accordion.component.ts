import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export interface AccordionItem {
  question: string;
  answer: string;
}

/** Question/answer list where one item is open at a time. */
@Component({
  selector: 'pp-accordion',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accordion.component.html',
  styleUrl: './accordion.component.scss',
})
export class AccordionComponent {
  readonly items = input.required<readonly AccordionItem[]>();

  protected readonly openIndex = signal<number | null>(null);

  protected toggle(index: number): void {
    this.openIndex.update(current => (current === index ? null : index));
  }
}
