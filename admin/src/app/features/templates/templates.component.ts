import { Component, ChangeDetectionStrategy, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CATALOG_EDIT_ROLES } from '../../core/constants/app.constants';
import { TEMPLATE_APPROVALS } from '../../core/constants/status.constants';
import { TEMPLATE_FIELDS, TEMPLATE_MAX_LENGTH } from '../../core/constants/template.constants';
import { MessageTemplate, TemplateKey, TemplateValues } from '../../core/models/template.model';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { TemplateService } from '../../core/services/template.service';
import { whatsappLink } from '../../core/utils/contact.utils';
import { agoLabel } from '../../core/utils/date.utils';
import { errorMessage } from '../../core/utils/error.utils';
import { fillTemplate } from '../../core/utils/message.utils';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../shared/components/status-pill/status-pill.component';

const GROUPS: MessageTemplate['group'][] = ['Bookings', 'Requests', 'Membership'];
const SAMPLE: TemplateValues = Object.fromEntries(TEMPLATE_FIELDS.map(f => [f.field, f.sample]));

/** The words sent on WhatsApp, with {fields} filled in per customer (design: "Message templates"). */
@Component({
  selector: 'pp-templates',
  imports: [ReactiveFormsModule, PageHeaderComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
})
export class TemplatesComponent {
  private templateService = inject(TemplateService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);

  protected readonly fields = TEMPLATE_FIELDS;
  protected readonly approvals = TEMPLATE_APPROVALS;
  protected readonly maxLength = TEMPLATE_MAX_LENGTH;
  protected readonly agoLabel = agoLabel;
  protected canEdit = computed(() => this.auth.hasRole(...CATALOG_EDIT_ROLES));

  protected selectedKey = signal<TemplateKey>('payment_link');
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  protected body = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(TEMPLATE_MAX_LENGTH)] });
  protected autoSend = new FormControl(false, { nonNullable: true });
  /** Live copy of the text for the preview and the counter. */
  protected text = signal('');

  private textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  protected groups = computed(() =>
    GROUPS.map(name => ({ name, items: this.templateService.templates().filter(t => t.group === name) })));
  protected selected = computed(() => this.templateService.templates().find(t => t.key === this.selectedKey()) ?? null);
  protected preview = computed(() => fillTemplate(this.text(), SAMPLE));
  protected tryHref = computed(() => whatsappLink('', this.preview()));

  constructor() {
    void this.templateService.load().then(() => this.fill());
    this.body.valueChanges.subscribe(v => this.text.set(v));
  }

  protected dirty(): boolean {
    return this.body.dirty || this.autoSend.dirty;
  }

  async select(t: MessageTemplate): Promise<void> {
    if (t.key === this.selectedKey() || !(await this.okToLeave())) return;
    this.selectedKey.set(t.key);
    this.fill();
  }

  /** Puts {field} where the cursor is in the message. */
  insert(field: string): void {
    const el = this.textarea()?.nativeElement;
    const value = this.body.value;
    const at = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? at;
    this.body.setValue(`${value.slice(0, at)}{${field}}${value.slice(end)}`);
    this.body.markAsDirty();
    const cursor = at + field.length + 2;
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  discard(): void {
    this.fill();
  }

  async save(): Promise<void> {
    const t = this.selected();
    if (!t || this.body.invalid || this.saving()) {
      this.body.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.templateService.save(t.key, this.body.value, this.autoSend.value);
      this.fill();
      this.alert.success(saved.approval === 'pending' && t.approval !== 'pending'
        ? `${saved.name} saved. WhatsApp checks the new text before it can go out automatically; Open WhatsApp works now.`
        : `${saved.name} saved.`);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  private fill(): void {
    const t = this.selected();
    this.body.reset(t?.body ?? '');
    this.autoSend.reset(t?.autoSend ?? false);
    this.text.set(this.body.value);
    this.error.set(null);
    if (!this.canEdit() || !t?.canAutoSend) this.autoSend.disable();
    else this.autoSend.enable();
    if (!this.canEdit()) this.body.disable();
  }

  private async okToLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    return this.confirm.ask({ title: 'Discard your changes?', message: 'You have unsaved changes to this template.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
  }
}
