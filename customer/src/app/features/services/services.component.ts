import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { CatalogService } from '../../core/services/catalog.service';
import { ServiceItem } from '../../core/models/catalog.model';
import { PetType } from '../../core/models/pet.model';
import { CtaBannerComponent } from '../../shared/components/cta-banner/cta-banner.component';
import { HowItWorksComponent } from '../../shared/components/how-it-works/how-it-works.component';
import { PageHeroComponent } from '../../shared/components/page-hero/page-hero.component';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header.component';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';

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
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);

  protected readonly activePet = signal<PetType>('dog');
  protected readonly services = computed(() => this.catalog.servicesFor(this.activePet()));

  switchPet(pet: PetType): void {
    this.activePet.set(pet);
  }

  startBooking(): void {
    void this.router.navigate(['/book'], { queryParams: { pet: this.activePet() } });
  }

  bookService(service: ServiceItem): void {
    void this.router.navigate(['/book'], { queryParams: { pet: service.petType, service: service.id } });
  }
}
