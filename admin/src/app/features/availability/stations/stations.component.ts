import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { SETTINGS_ROLES } from '../../../core/constants/app.constants';
import { Station, StationScope } from '../../../core/models/catalog.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { SwitchComponent } from '../../../shared/components/switch/switch.component';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';

const SCOPES: { value: StationScope; label: string }[] = [
  { value: 'all', label: 'Every service' },
  { value: 'dogs', label: 'Dog services' },
  { value: 'cats', label: 'Cat services' },
  { value: 'some', label: 'Chosen services' },
];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Availability › Stations: the shop's tables and rooms, whether each is in use, and which services it can do.
 * They decide how many pets are groomed at once. Admin and Super Admin change them; staff see them.
 */
@Component({
  selector: 'pp-stations',
  imports: [ReactiveFormsModule, RouterLink, ModalComponent, StatusPillComponent, SwitchComponent, HasRoleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stations.component.html',
  styleUrl: './stations.component.scss',
})
export class StationsComponent {
  protected catalog = inject(CatalogService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);

  protected readonly editors = SETTINGS_ROLES;
  protected readonly scopes = SCOPES;
  protected canEdit = computed(() => this.auth.hasRole(...SETTINGS_ROLES));

  /** Bookable services no station in use can do: customers can't book them. */
  protected gaps = computed(() =>
    this.catalog.services().filter(s => !s.archived && !this.catalog.stationsFor(s).length).map(s => `${s.name} (${s.petType})`));

  protected capacityText = computed(() => {
    const active = this.catalog.stations().filter(st => st.active);
    const takes = (type: 'dog' | 'cat') => active.filter(st => this.catalog.servicesFor(type).some(s => this.catalog.stationCanDo(st, s))).length;
    return `${plural(active.length, 'station')} in use: up to ${active.length} pets at once (${takes('dog')} can take dogs, ${takes('cat')} can take cats).`;
  });

  // ── Add / edit dialog: undefined = closed, null = new, a station = edit ──
  protected editing = signal<Station | null | undefined>(undefined);
  protected form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    active: [true],
    canDo: ['all' as StationScope],
  });
  protected serviceIds = signal<string[]>([]);
  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected serviceGroups = computed(() => [
    { label: 'Dog services', services: this.catalog.servicesFor('dog') },
    { label: 'Cat services', services: this.catalog.servicesFor('cat') },
  ]);

  constructor() {
    this.catalog.load().subscribe();
  }

  protected scopeText(st: Station): string {
    if (st.canDo === 'all') return 'Every service';
    if (st.canDo === 'dogs') return 'Every dog service';
    if (st.canDo === 'cats') return 'Every cat service';
    const names = this.catalog.services().filter(s => st.serviceIds.includes(s.id)).map(s => s.name);
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3} more` : names.join(', ');
  }

  openEditor(st: Station | null): void {
    this.form.reset({ name: st?.name ?? '', active: st?.active ?? true, canDo: st?.canDo ?? 'all' });
    this.serviceIds.set(st?.serviceIds ?? []);
    this.error.set(null);
    this.editing.set(st);
  }

  setActive(active: boolean): void {
    this.form.controls.active.setValue(active);
  }

  toggleService(id: string): void {
    this.serviceIds.update(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const existing = this.editing();
    this.saving.set(true);
    this.error.set(null);
    this.catalog.saveStation({ ...v, serviceIds: v.canDo === 'some' ? this.serviceIds() : [] }, existing?.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: saved => {
          this.editing.set(undefined);
          this.alert.success(existing ? `${saved.name} saved. New start times follow it.` : `${saved.name} added.`);
        },
        error: e => this.error.set(errorMessage(e)),
      });
  }

  async remove(): Promise<void> {
    const st = this.editing();
    if (!st) return;
    const ok = await this.confirm.ask({
      title: `Remove ${st.name}?`, message: 'It disappears from the calendar. To take it out for a while instead, switch it off.', confirmLabel: 'Remove station', tone: 'danger',
    });
    if (!ok) return;
    this.saving.set(true);
    this.catalog.removeStation(st.id).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.editing.set(undefined);
        this.alert.success(`${st.name} removed.`);
      },
      error: e => this.error.set(errorMessage(e)),
    });
  }
}
