import { Component, ChangeDetectionStrategy, ElementRef, computed, effect, inject, input, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VACCINATION } from '../../../core/constants/pet.constants';
import { CustomerPet } from '../../../core/models/customer.model';
import { Paged } from '../../../core/models/paged.model';
import { PetCounts, PetFilters, PetRecord, PetSummary } from '../../../core/models/pet.model';
import { AlertService } from '../../../core/services/alert.service';
import { PetService } from '../../../core/services/pet.service';
import { petAge, shortDate } from '../../../core/utils/date.utils';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SegmentedComponent } from '../../../shared/components/segmented/segmented.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { PetDialogComponent } from '../pet-dialog/pet-dialog.component';

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 250;

/** Every pet on file, with the selected pet's record beside the list (design: "Pets"). */
@Component({
  selector: 'pp-pet-list',
  imports: [RouterLink, PageHeaderComponent, SegmentedComponent, PaginationComponent, StatusPillComponent, IconComponent, PetDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pet-list.component.html',
  styleUrl: './pet-list.component.scss',
})
export class PetListComponent {
  private petService = inject(PetService);
  private alert = inject(AlertService);

  /** Query param: open this pet's record. */
  readonly petParam = input<string>(undefined, { alias: 'pet' });

  protected readonly vaccination = VACCINATION;
  protected readonly petAge = petAge;
  protected readonly shortDate = shortDate;

  protected query = signal('');
  protected type = signal('all');
  protected vaccinationDue = signal(false);
  protected page = signal(1);
  protected result = signal<Paged<PetSummary> | null>(null);
  protected counts = signal<PetCounts | null>(null);
  protected loading = signal(true);
  protected selectedId = linkedSignal<string | null>(() => this.petParam() ?? null);
  protected record = signal<PetRecord | null>(null);
  /** Pet dialog: undefined = closed, null = add, a pet = edit. */
  protected dialog = signal<CustomerPet | null | undefined>(undefined);

  private filters = computed<PetFilters>(() => ({
    q: this.query() || undefined,
    type: this.type() === 'all' ? undefined : (this.type() as 'dog' | 'cat'),
    vaccinationDue: this.vaccinationDue(),
    page: this.page(),
    pageSize: PAGE_SIZE,
  }));

  private panel = viewChild<ElementRef<HTMLElement>>('panel');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected typeOptions = computed(() => {
    const c = this.counts();
    return [
      { value: 'all', label: `All${c ? ` · ${c.all}` : ''}` },
      { value: 'dog', label: `Dogs${c ? ` · ${c.dog}` : ''}` },
      { value: 'cat', label: `Cats${c ? ` · ${c.cat}` : ''}` },
    ];
  });

  constructor() {
    void this.loadCounts();
    effect(() => {
      const filters = this.filters();
      untracked(() => void this.loadList(filters));
    });
    effect(() => {
      const id = this.selectedId();
      untracked(() => void this.loadRecord(id));
    });
  }

  onSearch(e: Event): void {
    const value = (e.target as HTMLInputElement).value.trim();
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.query.set(value);
      this.page.set(1);
    }, SEARCH_DELAY_MS);
  }

  setType(value: string): void {
    this.type.set(value);
    this.page.set(1);
  }

  onDueChange(e: Event): void {
    this.vaccinationDue.set((e.target as HTMLInputElement).checked);
    this.page.set(1);
  }

  select(id: string): void {
    this.selectedId.set(id);
    // On narrow screens the record sits below the list; bring it into view.
    if (window.innerWidth < 992) setTimeout(() => this.panel()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async onSaved(pet: CustomerPet): Promise<void> {
    const added = this.dialog() === null;
    this.dialog.set(undefined);
    this.alert.success(added ? `${pet.name} added.` : `${pet.name} saved.`);
    await Promise.all([this.loadList(this.filters()), this.loadCounts()]);
    this.selectedId.set(pet.id);
    await this.loadRecord(pet.id);
  }

  private async loadList(filters: PetFilters): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.petService.list(filters);
      this.result.set(result);
      if (!this.selectedId() && result.items.length) this.selectedId.set(result.items[0].pet.id);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCounts(): Promise<void> {
    this.counts.set(await this.petService.counts());
  }

  private async loadRecord(id: string | null): Promise<void> {
    this.record.set(id ? await this.petService.get(id) : null);
  }
}
