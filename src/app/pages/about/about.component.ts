import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { BookingDialogService } from '../../core/services/booking-dialog.service';
import { CatalogService } from '../../core/catalog/catalog.service';
import { Highlight } from '../../core/catalog/catalog.models';
import { CtaBannerComponent } from '../../shared/ui/cta-banner/cta-banner.component';
import { FeatureCardComponent } from '../../shared/ui/feature-card/feature-card.component';
import { PageHeroComponent } from '../../shared/ui/page-hero/page-hero.component';
import { SectionHeaderComponent } from '../../shared/ui/section-header/section-header.component';
import { TestimonialCardComponent } from '../../shared/ui/testimonial-card/testimonial-card.component';

interface Stat {
  value: string;
  label: string;
}

const VALUES: Highlight[] = [
  {
    icon: '🌿',
    title: 'Only safe products',
    description: 'Imported, organic, sulphate-free formulas. Nothing harsh, nothing that doesn\'t belong near your companion.',
  },
  {
    icon: '👨‍⚕️',
    title: 'Certified groomers',
    description: 'Every groomer on our team is trained, certified, and genuinely passionate about animal welfare.',
  },
  {
    icon: '🤝',
    title: 'Fear-free approach',
    description: 'We move at your pet\'s pace. Calm handling, gentle techniques — no stress, no rush.',
  },
  {
    icon: '✨',
    title: 'Honest pricing',
    description: 'No hidden fees, no surprise add-ons. The price you see is what you pay — every time.',
  },
];

const STATS: Stat[] = [
  { value: '500+', label: 'Happy pets' },
  { value: '6', label: 'Years in Pune' },
  { value: '4.9★', label: 'Google rating' },
];

@Component({
  selector: 'pp-about',
  imports: [
    PageHeroComponent, SectionHeaderComponent, FeatureCardComponent, TestimonialCardComponent, CtaBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  private readonly bookingDialog = inject(BookingDialogService);
  private readonly catalog = inject(CatalogService);

  protected readonly values = VALUES;
  protected readonly stats = STATS;
  protected readonly testimonials = this.catalog.testimonials;
  protected readonly trustPills = this.catalog.trustPills;

  openBookingDialog(): void {
    this.bookingDialog.open();
  }
}
