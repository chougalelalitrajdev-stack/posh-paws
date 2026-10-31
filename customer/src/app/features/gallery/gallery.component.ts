import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
// Call/callback dialog parked for later use; Book buttons now open the slot-booking flow.
// import { BookingDialogService } from '../../core/services/booking-dialog.service';
import { CtaBannerComponent } from '../../shared/components/cta-banner/cta-banner.component';
import { PageHeroComponent } from '../../shared/components/page-hero/page-hero.component';

export type GalleryFilter = 'all' | 'dog' | 'cat';

export interface GalleryItem {
  emoji: string;
  label: string;
  tag: string;
  category: 'dog' | 'cat';
}

const GALLERY_ITEMS: GalleryItem[] = [
  { emoji: '🐕',    label: 'Golden Retriever',  tag: 'Royal Package',        category: 'dog' },
  { emoji: '🐈',    label: 'Persian Cat',        tag: 'Full Groom & Trim',    category: 'cat' },
  { emoji: '🐩',    label: 'Poodle',             tag: 'Full Groom & Style',   category: 'dog' },
  { emoji: '🐈‍⬛',   label: 'Maine Coon',         tag: 'De-shedding Treatment',category: 'cat' },
  { emoji: '🦮',    label: 'Labrador',            tag: 'Signature Bath',       category: 'dog' },
  { emoji: '🐱',    label: 'Siamese',             tag: 'Nail Trim & Filing',   category: 'cat' },
  { emoji: '🐕‍🦺',   label: 'Corgi',              tag: 'Signature Bath',       category: 'dog' },
  { emoji: '😺',    label: 'Tabby Cat',           tag: 'Royale Cat Package',   category: 'cat' },
  { emoji: '🐶',    label: 'Beagle',              tag: 'Flea & Tick Spa',      category: 'dog' },
  { emoji: '😸',    label: 'Bengal Cat',          tag: 'Gentle Cat Bath',      category: 'cat' },
  { emoji: '🐺',    label: 'Husky',               tag: 'De-shedding Treatment',category: 'dog' },
  { emoji: '🐾',    label: 'Shih Tzu',            tag: 'Royal Package',        category: 'dog' },
];

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
  // private bookingDialog = inject(BookingDialogService);
  private router = inject(Router);

  protected activeFilter = signal<GalleryFilter>('all');
  protected stats        = STATS;

  protected filteredItems = computed(() => {
    const f = this.activeFilter();
    return f === 'all'
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter(item => item.category === f);
  });

  setFilter(f: GalleryFilter): void {
    this.activeFilter.set(f);
  }

  startBooking(): void {
    const f = this.activeFilter();
    // this.bookingDialog.open(f === 'all' ? undefined : { petType: f });
    void this.router.navigate(['/book'], { queryParams: { pet: f === 'all' ? undefined : f } });
  }
}
