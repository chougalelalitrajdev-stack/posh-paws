import { Component, ChangeDetectionStrategy, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CATALOG_EDIT_ROLES } from '../../../core/constants/app.constants';
import { PetType, Service, ServiceCategory, ServiceDraft } from '../../../core/models/catalog.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { formatDuration } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SegmentedComponent } from '../../../shared/components/segmented/segmented.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { SwitchComponent } from '../../../shared/components/switch/switch.component';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

type View = PetType | 'archived';

const CATEGORIES: ServiceCategory[] = ['Bath', 'Haircut', 'Package', 'Add-on', 'Treatment'];
const DURATIONS = [15, 20, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240];
export const MAX_DESCRIPTION = 140;

/** What customers see on the Services page and in booking (design: "Services + editor"). */
@Component({
  selector: 'pp-services',
  imports: [
    ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, PageHeaderComponent, SegmentedComponent, StatusPillComponent,
    SwitchComponent, ImageUploadComponent, IconComponent, HasRoleDirective, InrPipe, DurationPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent {
  private catalog = inject(CatalogService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);

  protected readonly categories = CATEGORIES;
  protected readonly editors = CATALOG_EDIT_ROLES;
  protected readonly maxDescription = MAX_DESCRIPTION;
  protected canEdit = computed(() => this.auth.hasRole(...CATALOG_EDIT_ROLES));

  protected view = signal<View>('dog');
  /** null = adding a new service. */
  protected selectedId = signal<string | null>(null);
  protected adding = signal(false);
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  private editor = viewChild<ElementRef<HTMLElement>>('editor');

  protected form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    priceRupees: [0, [Validators.required, Validators.min(1)]],
    durationMinutes: [45, Validators.required],
    category: ['Bath' as ServiceCategory],
    petType: ['dog' as PetType],
    description: ['', Validators.maxLength(MAX_DESCRIPTION)],
    imageUrl: [undefined as string | undefined],
    visible: [true],
  });

  /** Rows for the current tab, in display order (a local copy so dragging feels instant). */
  protected rows = signal<Service[]>([]);
  protected viewOptions = computed(() => {
    const all = this.catalog.services();
    const n = (f: (s: Service) => boolean) => all.filter(f).length;
    return [
      { value: 'dog', label: `Dogs · ${n(s => s.petType === 'dog' && !s.archived)}` },
      { value: 'cat', label: `Cats · ${n(s => s.petType === 'cat' && !s.archived)}` },
      { value: 'archived', label: `Archived · ${n(s => s.archived)}` },
    ];
  });
  protected selected = computed(() => this.catalog.services().find(s => s.id === this.selectedId()) ?? null);
  protected durations = computed(() => {
    const current = this.form.controls.durationMinutes.value;
    return [...new Set([...DURATIONS, current])].sort((a, b) => a - b).map(m => ({ value: m, label: formatDuration(m) }));
  });
  protected descriptionLength = signal(0);

  constructor() {
    void this.catalog.load().then(() => this.refreshRows(true));
    this.form.controls.description.valueChanges.subscribe(v => this.descriptionLength.set(v.length));
  }

  async setView(view: string): Promise<void> {
    if (!(await this.okToLeave())) return;
    this.view.set(view as View);
    this.refreshRows(true);
  }

  async select(s: Service): Promise<void> {
    if (s.id === this.selectedId() || !(await this.okToLeave())) return;
    this.adding.set(false);
    this.selectedId.set(s.id);
    this.fill(s);
    this.revealEditor();
  }

  async add(): Promise<void> {
    if (!(await this.okToLeave())) return;
    this.adding.set(true);
    this.selectedId.set(null);
    this.form.reset({ name: '', priceRupees: 0, durationMinutes: 45, category: 'Bath', petType: this.view() === 'cat' ? 'cat' : 'dog', description: '', imageUrl: undefined, visible: true });
    this.descriptionLength.set(0);
    this.revealEditor();
  }

  discard(): void {
    const s = this.selected();
    if (s) this.fill(s);
    else this.adding.set(false);
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      const draft: ServiceDraft = {
        name: v.name, petType: v.petType, category: v.category, description: v.description, durationMinutes: Number(v.durationMinutes),
        pricePaise: Math.round(Number(v.priceRupees)) * 100, imageUrl: v.imageUrl, visible: v.visible,
      };
      const saved = await this.catalog.saveService(draft, this.selectedId() ?? undefined);
      this.adding.set(false);
      this.selectedId.set(saved.id);
      if (!saved.archived) this.view.set(saved.petType);
      this.refreshRows(false);
      this.fill(saved);
      this.alert.success('Saved. The app shows the change within a minute.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async toggleVisible(s: Service, visible: boolean): Promise<void> {
    await this.catalog.saveService({ ...this.draftOf(s), visible }, s.id);
    this.refreshRows(false);
    if (s.id === this.selectedId()) this.form.controls.visible.setValue(visible);
    this.alert.success(visible ? `${s.name} is shown in the app.` : `${s.name} is hidden from the app. Staff can still book it.`);
  }

  async archive(): Promise<void> {
    const s = this.selected();
    if (!s) return;
    const upcoming = s.upcomingBookings === 1 ? 'The 1 upcoming booking for it stays as it is.' : `The ${s.upcomingBookings} upcoming bookings for it stay as they are.`;
    const ok = await this.confirm.ask({
      title: `Archive ${s.name}?`,
      message: `It disappears from the app and from new bookings. ${upcoming} You can restore it from Archived.`,
      confirmLabel: 'Archive service',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    await this.catalog.setArchived(s.id, true);
    this.form.markAsPristine();
    this.alert.success(`${s.name} archived.`);
    this.refreshRows(true);
  }

  async restore(): Promise<void> {
    const s = this.selected();
    if (!s) return;
    await this.catalog.setArchived(s.id, false);
    this.alert.success(`${s.name} restored. It's hidden from the app until you switch it on.`);
    this.view.set(s.petType);
    this.refreshRows(false);
    this.fill(this.selected()!);
  }

  async drop(e: CdkDragDrop<Service[]>): Promise<void> {
    if (e.previousIndex === e.currentIndex) return;
    const rows = [...this.rows()];
    moveItemInArray(rows, e.previousIndex, e.currentIndex);
    await this.saveOrder(rows);
  }

  /** Keyboard alternative to dragging: arrow keys on the handle move the row. */
  async moveWithKeys(e: KeyboardEvent, index: number): Promise<void> {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1;
    if (to < 0 || to >= this.rows().length) return;
    e.preventDefault();
    const rows = [...this.rows()];
    moveItemInArray(rows, index, to);
    await this.saveOrder(rows);
    setTimeout(() => document.getElementById(`handle-${rows[to].id}`)?.focus());
  }

  private async saveOrder(rows: Service[]): Promise<void> {
    this.rows.set(rows);
    await this.catalog.reorder(this.view() as PetType, rows.map(r => r.id));
  }

  private refreshRows(selectFirst: boolean): void {
    const view = this.view();
    const rows = this.catalog.services().filter(s => (view === 'archived' ? s.archived : s.petType === view && !s.archived));
    this.rows.set(rows);
    if (this.adding()) return;
    const keep = rows.find(r => r.id === this.selectedId());
    if (keep && !selectFirst) return;
    const first = keep ?? rows[0];
    this.selectedId.set(first?.id ?? null);
    if (first) this.fill(first);
  }

  private draftOf(s: Service): ServiceDraft {
    return {
      name: s.name, petType: s.petType, category: s.category, description: s.description,
      durationMinutes: s.durationMinutes, pricePaise: s.pricePaise, imageUrl: s.imageUrl, visible: s.visible,
    };
  }

  private fill(s: Service): void {
    this.form.reset({
      name: s.name, priceRupees: s.pricePaise / 100, durationMinutes: s.durationMinutes, category: s.category,
      petType: s.petType, description: s.description, imageUrl: s.imageUrl, visible: s.visible,
    });
    this.descriptionLength.set(s.description.length);
    this.error.set(null);
    if (!this.canEdit()) this.form.disable();
  }

  private async okToLeave(): Promise<boolean> {
    if (!this.form.dirty) return true;
    return this.confirm.ask({ title: 'Discard your changes?', message: 'You have unsaved changes to this service.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
  }

  private revealEditor(): void {
    if (window.innerWidth < 992) setTimeout(() => this.editor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}
