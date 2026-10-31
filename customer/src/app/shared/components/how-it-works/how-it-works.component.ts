import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CatalogService } from '../../../core/services/catalog.service';
import { SectionHeaderComponent } from '../section-header/section-header.component';

/** "Simple as three steps" list beside the green "everything your pet deserves" panel. */
@Component({
  selector: 'pp-how-it-works',
  imports: [SectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent {
  protected readonly catalog = inject(CatalogService);
}
