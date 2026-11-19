import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../../core/services/catalog.service';
import { hoursSummary } from '../../../core/utils/date.utils';
import { whatsappLink } from '../../../core/utils/text.utils';

@Component({
  selector: 'pp-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  private readonly catalog = inject(CatalogService);

  readonly year = new Date().getFullYear();
  // Contact details and hours from the admin (Settings › Business, Availability › Week).
  protected readonly business = computed(() => this.catalog.shop()?.business);
  protected readonly hours = computed(() => hoursSummary(this.catalog.shop()?.hours ?? []));
  protected readonly whatsapp = computed(() => whatsappLink(this.business()?.whatsapp));
  protected readonly services = computed(() => this.catalog.services().slice(0, 4));
}
