import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LoginDialogService } from '../../core/services/login-dialog.service';
// Call/callback dialog parked for later use; Book buttons now open the slot-booking flow.
// import { BookingDialogService } from '../../core/services/booking-dialog.service';
import { SubscribeDialogService } from '../../core/services/subscribe-dialog.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PlanItem } from '../../core/models/catalog.model';
import { PetType } from '../../core/models/pet.model';
import { HowItWorksComponent } from '../../shared/components/how-it-works/how-it-works.component';
import { PlanCardComponent } from '../../shared/components/plan-card/plan-card.component';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header.component';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { TestimonialCardComponent } from '../../shared/components/testimonial-card/testimonial-card.component';

interface GalleryItem {
  emoji: string;
  label: string;
}

const GALLERY_ITEMS: GalleryItem[] = [
  { emoji: '🐕',    label: 'Golden Retriever' },
  { emoji: '🐈',    label: 'Persian Cat'      },
  { emoji: '🐩',    label: 'Poodle'           },
  { emoji: '🐈‍⬛',   label: 'Maine Coon'       },
  { emoji: '🦮',    label: 'Labrador'          },
  { emoji: '🐾',    label: 'Shih Tzu'          },
];

@Component({
  selector: 'pp-home',
  imports: [
    RouterLink, SectionHeaderComponent, ServiceCardComponent, PlanCardComponent,
    TestimonialCardComponent, HowItWorksComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly catalog = inject(CatalogService);
  // private readonly bookingDialog = inject(BookingDialogService);
  private readonly router = inject(Router);
  private readonly subscribeDialog = inject(SubscribeDialogService);
  private readonly login = inject(LoginDialogService);

  protected readonly activePet = signal<PetType>('dog');
  protected readonly services = computed(() => this.catalog.servicesFor(this.activePet()));
  protected readonly plans = this.catalog.plans;
  protected readonly testimonials = this.catalog.testimonials;
  protected readonly trustPills = this.catalog.trustPills;
  protected readonly galleryItems = GALLERY_ITEMS;

  switchPet(pet: PetType): void {
    this.activePet.set(pet);
  }

  startBooking(): void {
    // this.bookingDialog.open({ petType: this.activePet() });
    void this.router.navigate(['/book'], { queryParams: { pet: this.activePet() } });
  }

  async subscribeToPlan(plan: PlanItem): Promise<void> {
    if (!(await this.login.ensureLoggedIn())) return;
    this.subscribeDialog.open(plan);
  }
}
