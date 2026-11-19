import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { LoginDialogService } from '../../core/services/login-dialog.service';
import { SubscribeDialogService } from '../../core/services/subscribe-dialog.service';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentService } from '../../core/services/content.service';
import { paragraphs } from '../../core/utils/text.utils';
import { appLinkPath } from '../../core/constants/content.constants';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { PlanItem } from '../../core/models/catalog.model';
import { PetType } from '../../core/models/pet.model';
import { HowItWorksComponent } from '../../shared/components/how-it-works/how-it-works.component';
import { PlanCardComponent } from '../../shared/components/plan-card/plan-card.component';
import { PromoBannerComponent } from '../../shared/components/promo-banner/promo-banner.component';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header.component';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { TestimonialCardComponent } from '../../shared/components/testimonial-card/testimonial-card.component';

@Component({
  selector: 'pp-home',
  imports: [
    RouterLink, SectionHeaderComponent, ServiceCardComponent, PlanCardComponent,
    TestimonialCardComponent, HowItWorksComponent, PromoBannerComponent, InrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly subscribeDialog = inject(SubscribeDialogService);
  private readonly login = inject(LoginDialogService);

  protected readonly activePet = signal<PetType>('dog');
  protected readonly services = computed(() => this.catalog.servicesFor(this.activePet()));
  protected readonly plans = this.catalog.plans;
  protected readonly testimonials = this.catalog.testimonials;
  protected readonly trustPills = this.catalog.trustPills;
  private readonly content = inject(ContentService);

  // The words, banners and photos come from the admin (Content › Pages & FAQs, Banners, Gallery).
  private readonly page = this.content.page('home');
  protected readonly heroBanner = this.content.banner('home_hero');
  protected readonly promoBanner = this.content.banner('home_promo');
  protected readonly photos = computed(() => this.content.gallery().photos.slice(0, 6));
  protected readonly featuredPlan = computed(() => this.plans().find(p => p.featured));
  protected readonly paragraphs = paragraphs;
  protected readonly bannerPath = appLinkPath;

  /** A section's words; undefined while loading or when staff have hidden it. */
  protected section(id: string) {
    return this.content.section(this.page(), id);
  }

  /** Sections show while the words load, and stay hidden once staff have hidden them. */
  protected shows(id: string): boolean {
    return !this.page() || !!this.section(id);
  }

  switchPet(pet: PetType): void {
    this.activePet.set(pet);
  }

  startBooking(): void {
    void this.router.navigate(['/book'], { queryParams: { pet: this.activePet() } });
  }

  subscribeToPlan(plan: PlanItem): void {
    this.login.ensureLoggedIn().pipe(filter(Boolean)).subscribe(() => this.subscribeDialog.open(plan));
  }
}
