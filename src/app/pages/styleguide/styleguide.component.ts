import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CatalogService } from '../../core/catalog/catalog.service';
import { PetGender } from '../../core/pets/pet.models';
import { PET_GENDER_OPTIONS } from '../../core/pets/pet.options';
import { ICON_PATHS, IconName } from '../../shared/ui/icon/icons';
import { AccordionComponent } from '../../shared/ui/accordion/accordion.component';
import { ChipGroupComponent } from '../../shared/ui/chip-group/chip-group.component';
import { FeatureCardComponent } from '../../shared/ui/feature-card/feature-card.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PlanCardComponent } from '../../shared/ui/plan-card/plan-card.component';
import { SectionHeaderComponent } from '../../shared/ui/section-header/section-header.component';
import { ServiceCardComponent } from '../../shared/ui/service-card/service-card.component';
import { TestimonialCardComponent } from '../../shared/ui/testimonial-card/testimonial-card.component';
import { DurationPipe } from '../../shared/ui/pipes/duration.pipe';
import { InrPipe } from '../../shared/ui/pipes/inr.pipe';

/** Development-only reference page (route `/styleguide`, registered only in dev mode). */
@Component({
  selector: 'pp-styleguide',
  imports: [
    AccordionComponent, ChipGroupComponent, FeatureCardComponent, IconComponent, PlanCardComponent,
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

  protected readonly service = this.catalog.servicesFor('dog')[0];
  protected readonly plan = this.catalog.plans[1];
  protected readonly testimonial = this.catalog.testimonials[0];
  protected readonly feature = this.catalog.serviceHighlights[0];

  protected readonly genderOptions = PET_GENDER_OPTIONS;
  protected readonly gender = signal<PetGender | null>('female');

  protected readonly faq = [
    { question: 'What is an accordion for?', answer: 'Hiding long answers until the visitor asks for them.' },
    { question: 'Can two be open at once?', answer: 'No. Opening one closes the other.' },
  ];
}
