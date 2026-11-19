import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { LoginDialogService } from '../../core/services/login-dialog.service';
import { SubscribeDialogService } from '../../core/services/subscribe-dialog.service';
import { CatalogService } from '../../core/services/catalog.service';
import { Highlight, PlanItem } from '../../core/models/catalog.model';
import { ContentService } from '../../core/services/content.service';
import { FaqSectionComponent } from '../../shared/components/faq-section/faq-section.component';
import { PromoBannerComponent } from '../../shared/components/promo-banner/promo-banner.component';
import { CtaBannerComponent } from '../../shared/components/cta-banner/cta-banner.component';
import { FeatureCardComponent } from '../../shared/components/feature-card/feature-card.component';
import { PageHeroComponent } from '../../shared/components/page-hero/page-hero.component';
import { PlanCardComponent } from '../../shared/components/plan-card/plan-card.component';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header.component';

const PERKS: Highlight[] = [
  {
    icon: '🗓️',
    title: 'Priority slots',
    description: 'Members get first pick of every week\'s calendar before slots open to walk-ins. No more waiting.',
  },
  {
    icon: '💰',
    title: 'Real savings',
    description: 'Posh and Royal members save between ₹400–₹800 per month compared to booking individually.',
  },
  {
    icon: '📋',
    title: 'Pet profile',
    description: 'We remember your pet\'s breed, coat, sensitivities, and groomer preferences — every single visit.',
  },
  {
    icon: '📸',
    title: 'Post-groom photos',
    description: 'Royal members receive a fresh photo on WhatsApp the moment their pet\'s session is complete.',
  },
];

@Component({
  selector: 'pp-membership',
  imports: [
    RouterLink, PageHeroComponent, SectionHeaderComponent, PlanCardComponent, FeatureCardComponent,
    FaqSectionComponent, PromoBannerComponent, CtaBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './membership.component.html',
  styleUrl: './membership.component.scss',
})
export class MembershipComponent {
  private readonly subscribeDialog = inject(SubscribeDialogService);
  private readonly login = inject(LoginDialogService);

  protected readonly plans = inject(CatalogService).plans;
  protected readonly perks = PERKS;
  private readonly content = inject(ContentService);

  // Questions and the banner come from the admin (Content › Pages & FAQs, Banners).
  protected readonly faq = this.content.faqsFor('Membership');
  protected readonly banner = this.content.banner('membership');

  subscribeToPlan(plan: PlanItem): void {
    this.login.ensureLoggedIn().pipe(filter(Boolean)).subscribe(() => this.subscribeDialog.open(plan));
  }
}
