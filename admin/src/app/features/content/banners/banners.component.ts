import { Component, ChangeDetectionStrategy, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CATALOG_EDIT_ROLES } from '../../../core/constants/app.constants';
import { APP_LINKS, BANNER_PLACEMENTS, BANNER_TITLE_MAX, IMAGE_SIZES } from '../../../core/constants/content.constants';
import { BANNER_STATUSES } from '../../../core/constants/status.constants';
import { AppLink, Banner, BannerDraft, BannerPlacement } from '../../../core/models/banner.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { BannerService } from '../../../core/services/banner.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { shortDate, today } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs/filter-tabs.component';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';

/** Promo banners in the customer app, per placement (design: "Banners"). */
@Component({
  selector: 'pp-banners',
  imports: [
    ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, PageHeaderComponent, FilterTabsComponent, StatusPillComponent,
    ImageUploadComponent, HasRoleDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banners.component.html',
  styleUrl: './banners.component.scss',
})
export class BannersComponent {
  private bannerService = inject(BannerService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);

  protected readonly placements = BANNER_PLACEMENTS;
  protected readonly links = APP_LINKS;
  protected readonly statuses = BANNER_STATUSES;
  protected readonly titleMax = BANNER_TITLE_MAX;
  protected readonly sizes = IMAGE_SIZES;
  protected readonly editors = CATALOG_EDIT_ROLES;
  protected canEdit = computed(() => this.auth.hasRole(...CATALOG_EDIT_ROLES));

  protected banners = signal<Banner[]>([]);
  protected placement = signal<BannerPlacement>('home_hero');
  /** null = new banner. */
  protected selectedId = signal<string | null>(null);
  protected adding = signal(false);
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  private editor = viewChild<ElementRef<HTMLElement>>('editor');

  protected form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(BANNER_TITLE_MAX)]],
    subtitle: [''],
    buttonText: ['Book now', Validators.required],
    link: ['book' as AppLink],
    placement: ['home_hero' as BannerPlacement],
    imageUrl: [undefined as string | undefined],
    desktopImageUrl: [undefined as string | undefined],
    startsOn: [today(), Validators.required],
    endsOn: [''],
  });

  /** Live copy of the form for the preview and the title counter. */
  protected value = signal(this.form.getRawValue());

  protected tabs = computed(() =>
    BANNER_PLACEMENTS.map(p => ({ key: p.value, label: p.label, count: this.banners().filter(b => b.placement === p.value).length })));
  /** This placement's banners, in display order (a local copy so dragging feels instant). */
  protected rows = signal<Banner[]>([]);
  protected selected = computed(() => this.banners().find(b => b.id === this.selectedId()) ?? null);
  protected placementLabel = computed(() => BANNER_PLACEMENTS.find(p => p.value === this.value().placement)?.label ?? '');

  constructor() {
    void this.load();
    this.form.valueChanges.subscribe(() => this.value.set(this.form.getRawValue()));
  }

  protected datesLabel(b: Banner): string {
    if (b.status === 'ended') return `Ended ${shortDate(b.endsOn!)}`;
    return `${shortDate(b.startsOn)} – ${b.endsOn ? shortDate(b.endsOn) : 'no end date'}`;
  }

  protected linkLabel(link: AppLink): string {
    return APP_LINKS.find(l => l.value === link)?.label ?? '';
  }

  async setPlacement(key: string): Promise<void> {
    if (key === this.placement() || !(await this.okToLeave())) return;
    this.placement.set(key as BannerPlacement);
    this.adding.set(false);
    this.refreshRows();
  }

  async select(b: Banner): Promise<void> {
    if (b.id === this.selectedId() || !(await this.okToLeave())) return;
    this.adding.set(false);
    this.selectedId.set(b.id);
    this.fill(b);
    this.revealEditor();
  }

  async add(): Promise<void> {
    if (!(await this.okToLeave())) return;
    this.adding.set(true);
    this.selectedId.set(null);
    this.fill(null);
    this.revealEditor();
  }

  setImage(control: 'imageUrl' | 'desktopImageUrl', url: string | undefined): void {
    this.form.controls[control].setValue(url);
    this.form.markAsDirty();
  }

  discard(): void {
    if (this.adding()) {
      this.adding.set(false);
      this.refreshRows();
    } else {
      this.fill(this.selected());
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const draft: BannerDraft = { ...v, endsOn: v.endsOn || null };
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.bannerService.save(draft, this.selectedId() ?? undefined);
      this.adding.set(false);
      this.selectedId.set(saved.id);
      this.placement.set(saved.placement);
      await this.load();
      this.alert.success(`${saved.title} saved. It’s ${BANNER_STATUSES[saved.status].label.toLowerCase()}.`);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async setPaused(paused: boolean): Promise<void> {
    const b = this.selected();
    if (!b || !(await this.okToLeave())) return;
    const saved = await this.bannerService.setPaused(b.id, paused);
    await this.load();
    this.alert.success(paused ? `${b.title} paused. The next live banner here shows instead.` : `${b.title} resumed. It’s ${BANNER_STATUSES[saved.status].label.toLowerCase()}.`);
  }

  async remove(): Promise<void> {
    const b = this.selected();
    if (!b) return;
    const ok = await this.confirm.ask({
      title: `Delete ${b.title}?`,
      message: 'It disappears from the app now. This can’t be undone.',
      confirmLabel: 'Delete banner',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    await this.bannerService.remove(b.id);
    this.form.markAsPristine();
    this.selectedId.set(null);
    await this.load();
    this.alert.success(`${b.title} deleted.`);
  }

  async drop(e: CdkDragDrop<Banner[]>): Promise<void> {
    if (e.previousIndex === e.currentIndex) return;
    await this.saveOrder(e.previousIndex, e.currentIndex);
  }

  /** Keyboard alternative to dragging: arrow keys on the handle move the row. */
  async moveWithKeys(e: KeyboardEvent, index: number): Promise<void> {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1;
    if (to < 0 || to >= this.rows().length) return;
    e.preventDefault();
    const id = this.rows()[index].id;
    await this.saveOrder(index, to);
    setTimeout(() => document.getElementById(`handle-${id}`)?.focus());
  }

  private async saveOrder(from: number, to: number): Promise<void> {
    const rows = [...this.rows()];
    moveItemInArray(rows, from, to);
    this.rows.set(rows);
    this.banners.set(await this.bannerService.reorder(this.placement(), rows.map(r => r.id)));
    this.rows.set(this.banners().filter(b => b.placement === this.placement()));
  }

  private async load(): Promise<void> {
    this.banners.set(await this.bannerService.list());
    this.refreshRows();
  }

  /** Shows the current placement's banners and keeps the selected one (or picks the first). */
  private refreshRows(): void {
    const rows = this.banners().filter(b => b.placement === this.placement());
    this.rows.set(rows);
    if (this.adding()) return;
    const pick = rows.find(r => r.id === this.selectedId()) ?? rows[0] ?? null;
    this.selectedId.set(pick?.id ?? null);
    this.fill(pick);
  }

  private fill(b: Banner | null): void {
    this.form.reset({
      title: b?.title ?? '', subtitle: b?.subtitle ?? '', buttonText: b?.buttonText ?? 'Book now', link: b?.link ?? 'book',
      placement: b?.placement ?? this.placement(), imageUrl: b?.imageUrl, desktopImageUrl: b?.desktopImageUrl,
      startsOn: b?.startsOn ?? today(), endsOn: b?.endsOn ?? '',
    });
    this.error.set(null);
    if (!this.canEdit()) this.form.disable();
    this.value.set(this.form.getRawValue());
  }

  private async okToLeave(): Promise<boolean> {
    if (!this.form.dirty) return true;
    return this.confirm.ask({ title: 'Discard your changes?', message: 'You have unsaved changes to this banner.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
  }

  private revealEditor(): void {
    if (window.innerWidth < 992) setTimeout(() => this.editor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}
