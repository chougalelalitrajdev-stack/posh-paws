import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { AlertService } from '../../core/services/alert.service';
import { CatalogService } from '../../core/services/catalog.service';
import { TimeSlot } from '../../core/models/booking.model';
import { upcomingDates } from '../../core/utils/date.utils';
import { PetGender } from '../../core/models/pet.model';
import { PET_GENDER_OPTIONS } from '../../core/constants/pet.constants';
import { ICON_PATHS, IconName } from '../../shared/components/icon/icons';
import { AccordionComponent } from '../../shared/components/accordion/accordion.component';
import { ChipGroupComponent } from '../../shared/components/chip-group/chip-group.component';
import { DateStripComponent } from '../../shared/components/date-strip/date-strip.component';
import { FeatureCardComponent } from '../../shared/components/feature-card/feature-card.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PlanCardComponent } from '../../shared/components/plan-card/plan-card.component';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header.component';
import { SlotGridComponent } from '../../shared/components/slot-grid/slot-grid.component';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { TestimonialCardComponent } from '../../shared/components/testimonial-card/testimonial-card.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { InrPipe } from '../../shared/pipes/inr.pipe';

/** Development-only reference page (route `/styleguide`, registered only in dev mode). */
@Component({
  selector: 'pp-styleguide',
  imports: [
    AccordionComponent, ChipGroupComponent, DateStripComponent, SlotGridComponent, FeatureCardComponent, IconComponent, PlanCardComponent,
    SectionHeaderComponent, ServiceCardComponent, TestimonialCardComponent, InrPipe, DurationPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './styleguide.component.html',
  styleUrl: './styleguide.component.scss',
})
export class StyleguideComponent {
  private readonly catalog = inject(CatalogService);

  protected readonly colours = [
    'primary', 'primary-dark', 'primary-light', 'accent', 'accent-dark', 'accent-light',
    'bg', 'surface', 'surface-2', 'sand', 'text', 'muted', 'subtle', 'border',
  ];
  protected readonly typeScale = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];
  protected readonly spacing = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
  protected readonly icons = Object.keys(ICON_PATHS) as IconName[];

  protected readonly alert = inject(AlertService);
  protected readonly service = computed(() => this.catalog.servicesFor('dog')[0]);
  protected readonly plan = computed(() => this.catalog.plans()[1]);
  protected readonly testimonial = this.catalog.testimonials[0];
  protected readonly feature = this.catalog.serviceHighlights[0];

  protected readonly genderOptions = PET_GENDER_OPTIONS;
  protected readonly gender = signal<PetGender | null>('female');

  protected readonly dates = upcomingDates(14);
  protected readonly date = signal<string | null>(this.dates[1]);
  protected readonly slots: TimeSlot[] = ['10:00', '10:30', '11:00', '14:00', '14:30', '17:30'].map((time, i) => ({ time, available: i % 3 !== 1 }));
  protected readonly slot = signal<string | null>('14:00');

  protected readonly faq = [
    { question: 'What is an accordion for?', answer: 'Hiding long answers until the visitor asks for them.' },
    { question: 'Can two be open at once?', answer: 'No. Opening one closes the other.' },
  ];
}
