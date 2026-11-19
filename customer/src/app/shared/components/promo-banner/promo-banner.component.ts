import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { appLinkPath } from '../../../core/constants/content.constants';
import { Banner } from '../../../core/models/content.model';

/** A promo banner from the admin (Content › Banners): picture, words and a button to one of the app's own pages. */
@Component({
  selector: 'pp-promo-banner',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './promo-banner.component.html',
  styleUrl: './promo-banner.component.scss',
})
export class PromoBannerComponent {
  readonly banner = input.required<Banner>();

  protected readonly path = computed(() => appLinkPath(this.banner().link));
  protected readonly picture = computed(() => this.banner().imageUrl ?? this.banner().desktopImageUrl);
}
