import { Component, ChangeDetectionStrategy, computed, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { OWNER_ROLES } from '../../core/constants/app.constants';
import { Settings } from '../../core/models/settings.model';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { SettingsService } from '../../core/services/settings.service';
import { errorMessage } from '../../core/utils/error.utils';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SwitchComponent } from '../../shared/components/switch/switch.component';
import { BookingSettingsComponent } from './booking-settings/booking-settings.component';
import { TeamSettingsComponent } from './team-settings/team-settings.component';

type Section = 'business' | 'booking' | 'payments' | 'notifications' | 'app' | 'team';
type SimpleSection = Exclude<Section, 'booking' | 'team'>;

const SECTIONS: { key: Section; label: string; hint: string; ownerOnly?: boolean }[] = [
  { key: 'business', label: 'Business', hint: 'Name, phones, address' },
  { key: 'booking', label: 'Booking & availability', hint: 'Hours, slots, closures' },
  { key: 'payments', label: 'Payments', hint: 'Link expiry, slot hold' },
  { key: 'notifications', label: 'Notifications', hint: 'Reminders and alerts' },
  { key: 'app', label: 'Customer app', hint: 'Book button, prices' },
  { key: 'team', label: 'Team & roles', hint: 'Staff accounts', ownerOnly: true },
];

export const LINK_HOURS = [6, 12, 24, 48, 72];
export const NUDGE_HOURS = [2, 4, 6, 12, 24];

/** Business settings (design: "Settings"). Super Admin and Admin; Team & roles is Super Admin only. */
@Component({
  selector: 'pp-settings',
  imports: [ReactiveFormsModule, PageHeaderComponent, SwitchComponent, BookingSettingsComponent, TeamSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private settingsService = inject(SettingsService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);

  protected readonly linkHours = LINK_HOURS;
  protected readonly nudgeHours = NUDGE_HOURS;
  protected sections = computed(() => SECTIONS.filter(s => !s.ownerOnly || this.auth.hasRole(...OWNER_ROLES)));
  protected section = signal<Section>('business');
  protected sectionLabel = computed(() => SECTIONS.find(s => s.key === this.section())!.label);
  protected settings = this.settingsService.settings;
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  private bookingSection = viewChild(BookingSettingsComponent);

  protected forms = {
    business: this.fb.group({
      name: ['', Validators.required], phone: [''], whatsapp: [''], email: ['', Validators.email], instagram: [''], mapsLink: [''], address: [''],
    }),
    payments: this.fb.group({ linkExpiryHours: [24], slotHoldRupees: [100, [Validators.required, Validators.min(1)]] }),
    notifications: this.fb.group({ reminderTime: ['18:00', Validators.required], unpaidNudgeHours: [6], staffAlerts: ['admins' as 'admins' | 'everyone'] }),
    app: this.fb.group({ bookButtonText: ['', [Validators.required, Validators.maxLength(20)]], showPrices: [true] }),
  };

  constructor() {
    void this.settingsService.load().then(s => this.fillAll(s));
  }

  protected simple(): SimpleSection | null {
    const s = this.section();
    return s === 'booking' || s === 'team' ? null : s;
  }

  async show(key: Section): Promise<void> {
    if (key === this.section() || !(await this.okToLeave())) return;
    this.section.set(key);
    this.error.set(null);
  }

  discard(): void {
    const s = this.settings();
    if (s) this.fillAll(s);
  }

  async save(): Promise<void> {
    const key = this.simple();
    if (!key) return;
    const form = this.forms[key];
    if (form.invalid || this.saving()) {
      form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.saveSection(key);
      this.fillAll(saved);
      this.alert.success(`${this.sectionLabel()} saved.`);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  private saveSection(key: SimpleSection): Promise<Settings> {
    const current = this.settings()!;
    switch (key) {
      case 'business': return this.settingsService.save('business', this.forms.business.getRawValue());
      case 'payments': {
        const v = this.forms.payments.getRawValue();
        return this.settingsService.save('payments', { ...current.payments, linkExpiryHours: Number(v.linkExpiryHours), slotHoldPaise: Math.round(Number(v.slotHoldRupees)) * 100 });
      }
      case 'notifications': {
        const v = this.forms.notifications.getRawValue();
        return this.settingsService.save('notifications', { ...v, unpaidNudgeHours: Number(v.unpaidNudgeHours) });
      }
      case 'app': return this.settingsService.save('app', this.forms.app.getRawValue());
    }
  }

  private fillAll(s: Settings): void {
    this.forms.business.reset(s.business);
    this.forms.payments.reset({ linkExpiryHours: s.payments.linkExpiryHours, slotHoldRupees: s.payments.slotHoldPaise / 100 });
    this.forms.notifications.reset(s.notifications);
    this.forms.app.reset(s.app);
  }

  private dirty(): boolean {
    const key = this.simple();
    return key ? this.forms[key].dirty : this.section() === 'booking' && !!this.bookingSection()?.dirty();
  }

  private async okToLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    const ok = await this.confirm.ask({ title: 'Discard your changes?', message: `You have unsaved changes in ${this.sectionLabel()}.`, confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
    if (ok) this.discard();
    return ok;
  }
}
