import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CATALOG_EDIT_ROLES } from '../../../core/constants/app.constants';
import { FaqData, PageKey, PageSection, SitePage } from '../../../core/models/page.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PageService } from '../../../core/services/page.service';
import { agoLabel, shortDate } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { FaqListComponent } from './faq-list/faq-list.component';

type View = PageKey | 'faqs';
type SectionGroup = FormGroup<{ [K in keyof PageSection]: FormControl<PageSection[K]> }>;

/** The words on the customer app's pages, and its FAQs (design: "Pages & FAQs"). */
@Component({
  selector: 'pp-pages',
  imports: [ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, PageHeaderComponent, StatusPillComponent, ModalComponent, FaqListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pages.component.html',
  styleUrl: './pages.component.scss',
})
export class PagesComponent {
  private pageService = inject(PageService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);

  protected canEdit = computed(() => this.auth.hasRole(...CATALOG_EDIT_ROLES));

  protected pages = signal<SitePage[]>([]);
  protected faqs = signal<FaqData>({ groups: [], faqs: [] });
  protected view = signal<View>('home');
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected previewOpen = signal(false);

  protected form = this.fb.group({ sections: this.fb.array<SectionGroup>([]) });

  protected page = computed(() => this.pages().find(p => p.key === this.view()) ?? null);
  protected liveLine = computed(() => {
    const p = this.page();
    return p ? `Live version published ${shortDate(p.publishedAt.slice(0, 10))} by ${p.publishedBy}` : '';
  });
  protected draftLine = computed(() => {
    const p = this.page();
    return p?.draft ? `saved ${agoLabel(p.draftSavedAt!)} by ${p.draftSavedBy}` : '';
  });

  constructor() {
    void this.load();
    void this.pageService.faqs().then(d => this.faqs.set(d));
  }

  get sections(): FormArray<SectionGroup> {
    return this.form.controls.sections;
  }

  /** Paragraphs of a section for the preview: a blank line starts a new one. */
  protected paragraphs(body: string): string[] {
    return body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }

  protected visibleSections(): PageSection[] {
    return this.sections.getRawValue().filter(s => s.visible);
  }

  async show(view: View): Promise<void> {
    if (view === this.view() || !(await this.okToLeave())) return;
    this.view.set(view);
    this.fill();
  }

  toggleVisible(group: SectionGroup): void {
    group.controls.visible.setValue(!group.controls.visible.value);
    this.form.markAsDirty();
  }

  addSection(): void {
    this.sections.push(this.sectionGroup({ id: '', kind: 'Text', heading: '', body: '', visible: true, fixed: false }));
    this.form.markAsDirty();
    setTimeout(() => document.getElementById(`section-heading-${this.sections.length - 1}`)?.focus());
  }

  async removeSection(i: number): Promise<void> {
    const heading = this.sections.at(i).controls.heading.value;
    const ok = await this.confirm.ask({
      title: `Remove ${heading ? `“${heading}”` : 'this section'}?`, message: 'It goes from the draft. The live page keeps it until you publish.',
      confirmLabel: 'Remove section', tone: 'danger',
    });
    if (!ok) return;
    this.sections.removeAt(i);
    this.form.markAsDirty();
  }

  drop(e: CdkDragDrop<unknown>): void {
    this.moveSection(e.previousIndex, e.currentIndex);
  }

  /** Keyboard alternative to dragging. */
  moveWithKeys(e: KeyboardEvent, i: number): void {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
    if (to < 0 || to >= this.sections.length) return;
    e.preventDefault();
    this.moveSection(i, to);
    setTimeout(() => document.getElementById(`section-handle-${to}`)?.focus());
  }

  async saveDraft(): Promise<boolean> {
    const p = this.page();
    if (!p || this.busy()) return false;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.replace(await this.pageService.saveDraft(p.key, this.sections.getRawValue()));
      this.fill();
      return true;
    } catch (e) {
      this.error.set(errorMessage(e));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async onSaveDraft(): Promise<void> {
    if (await this.saveDraft()) this.alert.success('Draft saved. Customers still see the live version.');
  }

  async publish(): Promise<void> {
    const p = this.page();
    if (!p) return;
    const ok = await this.confirm.ask({
      title: `Publish ${p.title}?`, message: 'Customers see these words in the app from now on.', confirmLabel: 'Publish',
    });
    if (!ok || (this.form.dirty && !(await this.saveDraft()))) return;
    this.busy.set(true);
    try {
      this.replace(await this.pageService.publish(p.key));
      this.fill();
      this.alert.success(`${p.title} published.`);
    } finally {
      this.busy.set(false);
    }
  }

  /** Drops unsaved edits, or the saved draft when there are none. */
  async discard(): Promise<void> {
    const p = this.page();
    if (!p) return;
    if (this.form.dirty) {
      this.fill();
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Discard the draft?', message: 'The page goes back to the live version. This can’t be undone.',
      confirmLabel: 'Discard draft', cancelLabel: 'Keep it', tone: 'danger',
    });
    if (!ok) return;
    this.replace(await this.pageService.discardDraft(p.key));
    this.fill();
    this.alert.success('Draft discarded.');
  }

  private moveSection(from: number, to: number): void {
    if (from === to) return;
    const items = [...this.sections.controls];
    moveItemInArray(items, from, to);
    this.sections.clear({ emitEvent: false });
    items.forEach(c => this.sections.push(c, { emitEvent: false }));
    this.form.markAsDirty();
  }

  private sectionGroup(s: PageSection): SectionGroup {
    return this.fb.group({ id: [s.id], kind: [s.kind], heading: [s.heading], body: [s.body], visible: [s.visible], fixed: [s.fixed] });
  }

  private fill(): void {
    const p = this.page();
    this.sections.clear({ emitEvent: false });
    (p?.draft ?? p?.sections ?? []).forEach(s => this.sections.push(this.sectionGroup(s), { emitEvent: false }));
    this.form.markAsPristine();
    this.error.set(null);
    if (!this.canEdit()) this.form.disable();
  }

  private replace(page: SitePage): void {
    this.pages.update(list => list.map(p => (p.key === page.key ? page : p)));
  }

  private async load(): Promise<void> {
    this.pages.set(await this.pageService.pages());
    this.fill();
  }

  private async okToLeave(): Promise<boolean> {
    if (!this.form.dirty) return true;
    return this.confirm.ask({ title: 'Discard your changes?', message: 'You have changes that aren’t saved as a draft.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
  }
}
