import { Component, ChangeDetectionStrategy, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { STAGES } from '../../../core/constants/status.constants';
import { SearchResults } from '../../../core/models/search.model';
import { SearchService } from '../../../core/services/search.service';
import { formatPhone } from '../../../core/utils/contact.utils';
import { shortDate } from '../../../core/utils/date.utils';
import { IconComponent } from '../../components/icon/icon.component';

const MIN_LENGTH = 2;
const DELAY_MS = 250;

interface Option {
  group: string;
  title: string;
  sub: string;
  link: string[];
  query?: Record<string, string>;
}

/**
 * Top-bar search for customers, phones, pets and booking IDs (design: "Search customer, phone, pet or booking ID").
 * "/" focuses it; arrow keys move through results; Enter opens one. On phones it opens from a search button.
 */
@Component({
  selector: 'pp-global-search',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './global-search.component.html',
  styleUrl: './global-search.component.scss',
  host: { '(document:keydown)': 'onDocumentKey($event)' },
})
export class GlobalSearchComponent {
  private searchService = inject(SearchService);
  private router = inject(Router);

  protected query = signal('');
  protected open = signal(false);
  protected active = signal(-1);
  /** Phones: the search bar is hidden behind a button. */
  protected expanded = signal(false);
  private input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  /** Latest results and the text they were for; typing again cancels the previous search. */
  private response = toSignal(
    toObservable(this.query).pipe(
      map(q => q.trim()),
      debounceTime(DELAY_MS),
      distinctUntilChanged(),
      switchMap(q =>
        q.length < MIN_LENGTH
          ? of({ q, results: null })
          : this.searchService.search(q).pipe(map(results => ({ q, results: results as SearchResults | null })), catchError(() => of({ q, results: null }))),
      ),
    ),
    { initialValue: { q: '', results: null } },
  );

  protected showPanel = computed(() => this.open() && this.query().trim().length >= MIN_LENGTH);
  protected searching = computed(() => this.response().q !== this.query().trim());

  protected options = computed<Option[]>(() => {
    const r = this.response().results;
    if (!r || this.searching()) return [];
    return [
      ...r.customers.map(c => ({
        group: 'Customers', title: c.name, sub: [formatPhone(c.phone), c.petNames.join(', ')].filter(Boolean).join(' · '), link: ['/customers', c.id],
      })),
      ...r.pets.map(p => ({
        group: 'Pets', title: p.name, sub: [p.breed ?? (p.type === 'dog' ? 'Dog' : 'Cat'), p.ownerName].join(' · '), link: ['/pets'], query: { pet: p.id },
      })),
      ...r.bookings.map(b => ({
        group: 'Bookings', title: `${b.id} · ${b.customerName}`,
        sub: [b.petName, b.serviceName, b.date ? `${shortDate(b.date)} ${b.time ?? ''}`.trim() : null, STAGES[b.stage].label].filter(Boolean).join(' · '),
        link: ['/bookings', b.id],
      })),
    ];
  });

  onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.open.set(true);
    this.active.set(-1);
  }

  /** "/" anywhere outside a form field jumps to search. */
  onDocumentKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (e.key !== '/' || target.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    this.expand();
  }

  onKey(e: KeyboardEvent): void {
    const count = this.options().length;
    if (e.key === 'ArrowDown' && count) {
      e.preventDefault();
      this.active.update(i => (i + 1) % count);
    } else if (e.key === 'ArrowUp' && count) {
      e.preventDefault();
      this.active.update(i => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = this.options()[this.active()];
      if (option) void this.router.navigate(option.link, { queryParams: option.query });
      else if (this.query().trim().length >= MIN_LENGTH) this.seeAll();
      this.close();
    } else if (e.key === 'Escape') {
      this.close();
      this.input().nativeElement.blur();
    }
  }

  expand(): void {
    this.expanded.set(true);
    setTimeout(() => this.input().nativeElement.focus());
  }

  /** Close when focus leaves the search box and its results. */
  onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (!next || !(e.currentTarget as HTMLElement).contains(next)) {
      this.open.set(false);
      this.expanded.set(false);
    }
  }

  seeAll(): void {
    void this.router.navigate(['/customers'], { queryParams: { q: this.query().trim() } });
    this.close();
  }

  close(): void {
    this.open.set(false);
    this.expanded.set(false);
    this.active.set(-1);
    this.query.set('');
    this.input().nativeElement.value = '';
  }
}
