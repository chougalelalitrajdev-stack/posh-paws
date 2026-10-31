import { Injectable, signal } from '@angular/core';
import { PlanItem } from '../models/catalog.model';

export type SubscribeDialogStep = 'confirm' | 'payment' | 'success';

/**
 * Drives the global "Subscribe to a plan" dialog — mirrors
 * BookingDialogService's split: this service only holds state and
 * step transitions, any simulated async work lives in the component.
 */
@Injectable({ providedIn: 'root' })
export class SubscribeDialogService {
  readonly isOpen = signal(false);
  readonly step = signal<SubscribeDialogStep>('confirm');
  readonly plan = signal<PlanItem | null>(null);

  open(plan: PlanItem): void {
    this.plan.set(plan);
    this.step.set('confirm');
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  goToPayment(): void {
    this.step.set('payment');
  }

  goToConfirm(): void {
    this.step.set('confirm');
  }

  markSubscribed(): void {
    this.step.set('success');
  }
}
