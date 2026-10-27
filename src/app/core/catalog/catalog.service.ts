import { Injectable } from '@angular/core';
import { PetType } from '../pets/pet.models';
import {
  PLANS, PROCESS_STEPS, SERVICES, SERVICE_HIGHLIGHTS, TESTIMONIALS, TRUST_PILLS,
} from './catalog.data';
import { Highlight, PlanItem, ProcessStep, ServiceItem, Testimonial } from './catalog.models';

/**
 * Single source of truth for catalog content (services, plans, testimonials...).
 * Pages read from here and never define their own copies. When the backend
 * arrives, load these from an API inside this service; callers don't change.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly plans: readonly PlanItem[] = PLANS;
  readonly testimonials: readonly Testimonial[] = TESTIMONIALS;
  readonly processSteps: readonly ProcessStep[] = PROCESS_STEPS;
  readonly serviceHighlights: readonly Highlight[] = SERVICE_HIGHLIGHTS;
  readonly trustPills: readonly string[] = TRUST_PILLS;

  servicesFor(petType: PetType): ServiceItem[] {
    return SERVICES.filter(s => s.petType === petType);
  }
}
