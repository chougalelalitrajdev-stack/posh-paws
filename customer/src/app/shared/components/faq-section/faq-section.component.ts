import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccordionComponent, AccordionItem } from '../accordion/accordion.component';
import { SectionHeaderComponent } from '../section-header/section-header.component';

/** "Common questions" with an accordion. Shows nothing when there are no questions. */
@Component({
  selector: 'pp-faq-section',
  imports: [AccordionComponent, SectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './faq-section.component.html',
  styleUrl: './faq-section.component.scss',
})
export class FaqSectionComponent {
  readonly items = input.required<readonly AccordionItem[]>();
  readonly surface = input<'plain' | 'tinted'>('tinted');
}
