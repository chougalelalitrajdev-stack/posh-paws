import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BookingDialogService } from '../../core/services/booking-dialog.service';
import { CatalogService } from '../../core/catalog/catalog.service';
import { ServiceItem } from '../../core/catalog/catalog.models';
import { PetType } from '../../core/pets/pet.models';
import { CtaBannerComponent } from '../../shared/ui/cta-banner/cta-banner.component';
import { HowItWorksComponent } from '../../shared/ui/how-it-works/how-it-works.component';
import { PageHeroComponent } from '../../shared/ui/page-hero/page-hero.component';
import { SectionHeaderComponent } from '../../shared/ui/section-header/section-header.component';
import { ServiceCardComponent } from '../../shared/ui/service-card/service-card.component';

@Component({
  selector: 'pp-services',
  imports: [
    NgTemplateOutlet, PageHeroComponent, SectionHeaderComponent, ServiceCardComponent,
    HowItWorksComponent, CtaBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent {
  private readonly bookingDialog = inject(BookingDialogService);
  private readonly catalog = inject(CatalogService);

  protected readonly activePet = signal<PetType>('dog');
  protected readonly services = computed(() => this.catalog.servicesFor(this.activePet()));

  switchPet(pet: PetType): void {
    this.activePet.set(pet);
  }

  openBookingDialog(): void {
    this.bookingDialog.open({ petType: this.activePet() });
  }

  bookService(service: ServiceItem): void {
    this.bookingDialog.open({ petType: this.activePet(), serviceName: service.name });
  }
}
