import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginDialogService } from '../../core/auth/login-dialog.service';
import { BookingDialogService } from '../../core/services/booking-dialog.service';
import { SubscribeDialogService } from '../../core/services/subscribe-dialog.service';
import { CatalogService } from '../../core/catalog/catalog.service';
import { PlanItem } from '../../core/catalog/catalog.models';
import { PetType } from '../../core/pets/pet.models';
import { HowItWorksComponent } from '../../shared/ui/how-it-works/how-it-works.component';
import { PlanCardComponent } from '../../shared/ui/plan-card/plan-card.component';
import { SectionHeaderComponent } from '../../shared/ui/section-header/section-header.component';
import { ServiceCardComponent } from '../../shared/ui/service-card/service-card.component';
import { TestimonialCardComponent } from '../../shared/ui/testimonial-card/testimonial-card.component';

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
  private readonly bookingDialog = inject(BookingDialogService);
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

  openBookingDialog(): void {
    this.bookingDialog.open({ petType: this.activePet() });
  }

  async subscribeToPlan(plan: PlanItem): Promise<void> {
    if (!(await this.login.ensureLoggedIn())) return;
    this.subscribeDialog.open(plan);
  }
}
