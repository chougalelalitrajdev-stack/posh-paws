import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable, catchError, concatMap, finalize, from, map, of, switchMap, tap, toArray } from 'rxjs';
import { CATALOG_EDIT_ROLES } from '../../../core/constants/app.constants';
import { IMAGE_SIZES } from '../../../core/constants/content.constants';
import { GalleryBulkAction, GalleryData, GalleryPhoto } from '../../../core/models/gallery.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { GalleryService } from '../../../core/services/gallery.service';
import { UploadService } from '../../../core/services/upload.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { IMAGE_TYPES } from '../../../core/utils/image.utils';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs/filter-tabs.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';
import { PhotoDialogComponent } from './photo-dialog/photo-dialog.component';

const ALL = 'all';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Photos on the app's Gallery page (design: "Gallery"). */
@Component({
  selector: 'pp-gallery',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, PageHeaderComponent, FilterTabsComponent, ModalComponent, IconComponent, HasRoleDirective, PhotoDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent {
  private gallery = inject(GalleryService);
  private uploads = inject(UploadService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);

  protected readonly accept = IMAGE_TYPES.join(',');
  protected readonly editors = CATALOG_EDIT_ROLES;
  protected canEdit = computed(() => this.auth.hasRole(...CATALOG_EDIT_ROLES));

  protected data = signal<GalleryData>({ categories: [], photos: [] });
  protected loaded = signal(false);
  protected category = signal(ALL);
  protected selectedIds = signal<string[]>([]);
  protected editing = signal<GalleryPhoto | null>(null);
  protected dragging = signal(false);
  /** "Uploading 2 of 5…" while files go up. */
  protected progress = signal<string | null>(null);
  protected uploadErrors = signal<string[]>([]);

  protected tabs = computed(() => [
    { key: ALL, label: 'All', count: this.data().photos.length },
    ...this.data().categories.map(c => ({ key: c.id, label: c.name, count: c.photoCount })),
  ]);
  /** Photos in the current tab, in display order (a local copy so dragging feels instant). */
  protected photos = signal<GalleryPhoto[]>([]);
  protected categoryName = computed(() => new Map(this.data().categories.map(c => [c.id, c.name])));

  // Manage categories dialog
  protected categoriesOpen = signal(false);
  protected categoryRows = signal<{ id?: string; name: string; photoCount: number }[]>([]);
  protected categoryError = signal<string | null>(null);
  protected savingCategories = signal(false);

  constructor() {
    this.load().subscribe();
  }

  setCategory(key: string): void {
    this.category.set(key);
    this.selectedIds.set([]);
    this.refreshPhotos();
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggle(id: string): void {
    this.selectedIds.update(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  }

  // ── Upload ──

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    if (e.dataTransfer?.files.length && this.canEdit()) this.upload([...e.dataTransfer.files]);
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (this.canEdit()) this.dragging.set(true);
  }

  onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length) this.upload(files);
  }

  /** Uploads one at a time into the current category (or the first one), hidden until captioned. */
  private upload(files: File[]): void {
    const categoryId = this.category() === ALL ? this.data().categories[0]?.id : this.category();
    if (!categoryId) return;
    from(files).pipe(
      // One file at a time (concatMap), so the progress line and the demo storage check stay in order.
      concatMap((file, i) => {
        this.progress.set(`Uploading ${i + 1} of ${files.length}…`);
        return this.uploads.uploadImage(file, IMAGE_SIZES.gallery).pipe(
          switchMap(url => this.gallery.add(url, categoryId, '')),
          map(() => null),
          catchError(e => of(`${file.name}: ${e instanceof HttpErrorResponse || !(e instanceof Error) ? errorMessage(e) : e.message}`)),
        );
      }),
      toArray(),
      finalize(() => this.progress.set(null)),
    ).subscribe(results => {
      const errors = results.filter((r): r is string => r !== null);
      const added = results.length - errors.length;
      this.uploadErrors.set(errors);
      if (!added) return;
      this.load().subscribe(() =>
        this.alert.success(`${plural(added, 'photo')} added to ${this.categoryName().get(categoryId)}. Add captions, then show them in the app.`));
    });
  }

  // ── Selected photos ──

  async bulk(action: 'show' | 'hide' | 'delete'): Promise<void> {
    const ids = this.selectedIds();
    if (action === 'delete') {
      const ok = await this.confirm.ask({
        title: `Delete ${plural(ids.length, 'photo')}?`,
        message: 'They disappear from the app and from here. This can’t be undone.',
        confirmLabel: 'Delete', cancelLabel: 'Keep them', tone: 'danger',
      });
      if (!ok) return;
    }
    this.runBulk({ action, ids }, { show: 'shown in the app', hide: 'hidden from the app', delete: 'deleted' }[action]);
  }

  moveTo(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const categoryId = select.value;
    select.value = '';
    if (categoryId) this.runBulk({ action: 'move', ids: this.selectedIds(), categoryId }, `moved to ${this.categoryName().get(categoryId)}`);
  }

  private runBulk(action: GalleryBulkAction, done: string): void {
    const n = action.ids.length;
    this.gallery.bulk(action).subscribe(data => {
      this.apply(data);
      this.selectedIds.set([]);
      this.alert.success(`${plural(n, 'photo')} ${done}.`);
    });
  }

  // ── One photo ──

  onPhotoSaved(photo: GalleryPhoto): void {
    this.editing.set(null);
    this.load().subscribe(() => this.alert.success(photo.visible ? 'Photo saved. It’s shown in the app.' : 'Photo saved. It’s hidden from the app.'));
  }

  async onPhotoDeleted(photo: GalleryPhoto): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete this photo?', message: 'It disappears from the app and from here. This can’t be undone.',
      confirmLabel: 'Delete photo', cancelLabel: 'Keep it', tone: 'danger',
    });
    if (!ok) return;
    this.editing.set(null);
    this.runBulk({ action: 'delete', ids: [photo.id] }, 'deleted');
  }

  // ── Reorder ──

  drop(e: CdkDragDrop<GalleryPhoto[]>): void {
    if (e.previousIndex !== e.currentIndex) this.saveOrder(e.previousIndex, e.currentIndex);
  }

  /** Keyboard alternative to dragging: arrow keys on the handle move the photo. */
  moveWithKeys(e: KeyboardEvent, index: number): void {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    const to = step === undefined ? -1 : index + step;
    if (to < 0 || to >= this.photos().length) return;
    e.preventDefault();
    const id = this.photos()[index].id;
    this.saveOrder(index, to);
    setTimeout(() => document.getElementById(`handle-${id}`)?.focus());
  }

  /** Shows the new order straight away, then saves it. */
  private saveOrder(fromIndex: number, toIndex: number): void {
    const photos = [...this.photos()];
    moveItemInArray(photos, fromIndex, toIndex);
    this.photos.set(photos);
    this.gallery.reorder(photos.map(p => p.id)).subscribe(data => this.apply(data));
  }

  // ── Categories ──

  openCategories(): void {
    this.categoryRows.set(this.data().categories.map(c => ({ ...c })));
    this.categoryError.set(null);
    this.categoriesOpen.set(true);
  }

  renameCategory(i: number, name: string): void {
    this.categoryRows.update(rows => rows.map((r, j) => (j === i ? { ...r, name } : r)));
  }

  addCategory(): void {
    this.categoryRows.update(rows => [...rows, { name: '', photoCount: 0 }]);
    setTimeout(() => document.getElementById(`category-${this.categoryRows().length - 1}`)?.focus());
  }

  removeCategory(i: number): void {
    this.categoryRows.update(rows => rows.filter((_, j) => j !== i));
  }

  saveCategories(): void {
    this.savingCategories.set(true);
    this.categoryError.set(null);
    this.gallery.saveCategories(this.categoryRows().map(({ id, name }) => ({ id, name })))
      .pipe(finalize(() => this.savingCategories.set(false)))
      .subscribe({
        next: data => {
          this.apply(data);
          if (this.category() !== ALL && !this.data().categories.some(c => c.id === this.category())) this.setCategory(ALL);
          this.categoriesOpen.set(false);
          this.alert.success('Categories saved.');
        },
        error: e => this.categoryError.set(errorMessage(e)),
      });
  }

  private load(): Observable<GalleryData> {
    return this.gallery.load().pipe(tap(data => {
      this.apply(data);
      this.loaded.set(true);
    }));
  }

  private apply(data: GalleryData): void {
    this.data.set(data);
    this.selectedIds.update(ids => ids.filter(id => data.photos.some(p => p.id === id)));
    this.refreshPhotos();
  }

  private refreshPhotos(): void {
    const c = this.category();
    this.photos.set(this.data().photos.filter(p => c === ALL || p.categoryId === c));
  }
}
