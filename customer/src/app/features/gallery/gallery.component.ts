import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { ContentService } from '../../core/services/content.service';
import { Router } from '@angular/router';
import { CtaBannerComponent } from '../../shared/components/cta-banner/cta-banner.component';
import { PageHeroComponent } from '../../shared/components/page-hero/page-hero.component';

const STATS = [
  { value: '500+', label: 'Pets groomed' },
  { value: '6 yrs', label: 'In business' },
  { value: '4.9 ★', label: 'Google rating' },
];

@Component({
  selector: 'pp-gallery',
  imports: [PageHeroComponent, CtaBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gallery.component.html',
  styleUrl:    './gallery.component.scss',
})
export class GalleryComponent {
  private router = inject(Router);
  // Shown photos and their categories, from the admin (Content › Gallery).
  private readonly gallery = inject(ContentService).gallery;

  protected readonly categories = computed(() => this.gallery().categories);
  protected readonly activeCategory = signal<string | null>(null);
  protected readonly loaded = computed(() => this.gallery().photos.length > 0);
  protected readonly photos = computed(() => {
    const category = this.activeCategory();
    return this.gallery().photos.filter(p => !category || p.categoryId === category);
  });
  protected readonly stats = STATS;

  setCategory(id: string | null): void {
    this.activeCategory.set(id);
  }

  startBooking(): void {
    void this.router.navigate(['/book']);
  }
}
