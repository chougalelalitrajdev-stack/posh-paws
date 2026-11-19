import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentService } from '../../core/services/content.service';
import { paragraphs } from '../../core/utils/text.utils';
import { Highlight } from '../../core/models/catalog.model';
import { CtaBannerComponent } from '../../shared/components/cta-banner/cta-banner.component';
import { FaqSectionComponent } from '../../shared/components/faq-section/faq-section.component';
import { FeatureCardComponent } from '../../shared/components/feature-card/feature-card.component';
import { PageHeroComponent } from '../../shared/components/page-hero/page-hero.component';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header.component';
import { TestimonialCardComponent } from '../../shared/components/testimonial-card/testimonial-card.component';

interface Stat {
  value: string;
  label: string;
}

/** Icons for the value cards, in order (the words come from the admin). */
const VALUE_ICONS = ['🌿', '👨‍⚕️', '🤝', '✨'];

const STATS: Stat[] = [
  { value: '500+', label: 'Happy pets' },
  { value: '6', label: 'Years in Pune' },
  { value: '4.9★', label: 'Google rating' },
];

@Component({
  selector: 'pp-about',
  imports: [
    PageHeroComponent, SectionHeaderComponent, FeatureCardComponent, TestimonialCardComponent, CtaBannerComponent, FaqSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);

  private readonly content = inject(ContentService);
  private readonly page = this.content.page('about');

  // The words come from the admin (Content › Pages & FAQs › About).
  protected readonly intro = computed(() => this.content.section(this.page(), 'about-intro'));
  protected readonly valuesSection = computed(() => this.content.section(this.page(), 'about-values'));
  protected readonly team = computed(() => this.content.section(this.page(), 'about-team'));
  protected readonly faq = this.content.faqsFor('About');
  protected readonly paragraphs = paragraphs;

  /** Each values paragraph is a card: "Only safe products. Imported, organic…" → title + description. */
  protected readonly values = computed<Highlight[]>(() => paragraphs(this.valuesSection()?.body).map((text, i) => {
    const stop = text.indexOf('. ');
    return {
      icon: VALUE_ICONS[i % VALUE_ICONS.length],
      title: stop > 0 ? text.slice(0, stop) : text,
      description: stop > 0 ? text.slice(stop + 2) : '',
    };
  }));
  protected readonly stats = STATS;
  protected readonly testimonials = this.catalog.testimonials;
  protected readonly trustPills = this.catalog.trustPills;

  startBooking(): void {
    void this.router.navigate(['/book']);
  }
}
