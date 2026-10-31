import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginDialogService } from '../../core/services/login-dialog.service';
import { SubscribeDialogService } from '../../core/services/subscribe-dialog.service';
import { CatalogService } from '../../core/services/catalog.service';
import { Highlight, PlanItem } from '../../core/models/catalog.model';
import { AccordionComponent, AccordionItem } from '../../shared/components/accordion/accordion.component';
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

const FAQ: AccordionItem[] = [
  {
    question: 'Can I cancel or change my plan anytime?',
    answer: 'Yes. You can upgrade, downgrade, or cancel your membership at any time before the next billing cycle. No lock-in, no penalties.',
  },
  {
    question: 'Do unused sessions roll over to the next month?',
    answer: 'Sessions are valid for the calendar month. They do not roll over, so we recommend booking early to make the most of your plan.',
  },
  {
    question: 'Can I use my membership for both dogs and cats?',
    answer: 'Absolutely. Your membership covers all pets linked to your profile. Add multiple pets and the sessions are shared across them.',
  },
  {
    question: 'How does the ₹100 slot hold work for members?',
    answer: 'Members still place a ₹100 refundable hold to confirm a booking. It is fully returned when you arrive for the appointment.',
  },
];

@Component({
  selector: 'pp-membership',
  imports: [
    RouterLink, PageHeroComponent, SectionHeaderComponent, PlanCardComponent, FeatureCardComponent,
    AccordionComponent, CtaBannerComponent,
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
  protected readonly faq = FAQ;

  async subscribeToPlan(plan: PlanItem): Promise<void> {
    if (!(await this.login.ensureLoggedIn())) return;
    this.subscribeDialog.open(plan);
  }
}
