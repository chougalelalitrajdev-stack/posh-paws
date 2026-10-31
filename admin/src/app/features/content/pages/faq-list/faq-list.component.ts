import { Component, ChangeDetectionStrategy, computed, inject, input, model, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Faq, FaqData } from '../../../../core/models/page.model';
import { AlertService } from '../../../../core/services/alert.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { PageService } from '../../../../core/services/page.service';
import { errorMessage } from '../../../../core/utils/error.utils';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

/** FAQs by group, with add, edit, delete and reorder. They go live when saved. */
@Component({
  selector: 'pp-faq-list',
  imports: [ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './faq-list.component.html',
  styleUrl: './faq-list.component.scss',
})
export class FaqListComponent {
  private pageService = inject(PageService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);

  readonly data = model.required<FaqData>();
  readonly canEdit = input(false);

  protected groups = computed(() => this.data().groups.map(g => ({ ...g, faqs: this.data().faqs.filter(f => f.groupId === g.id) })));

  /** The question in the dialog; null = adding one. undefined = dialog closed. */
  protected editing = signal<Faq | null | undefined>(undefined);
  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected form = inject(NonNullableFormBuilder).group({
    groupId: [''],
    question: ['', Validators.required],
    answer: ['', Validators.required],
  });

  open(faq: Faq | null, groupId?: string): void {
    this.form.reset({ groupId: faq?.groupId ?? groupId ?? this.data().groups[0]?.id ?? '', question: faq?.question ?? '', answer: faq?.answer ?? '' });
    this.error.set(null);
    this.editing.set(faq);
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const faq = this.editing();
      await this.pageService.saveFaq(this.form.getRawValue(), faq?.id);
      this.data.set(await this.pageService.faqs());
      this.editing.set(undefined);
      this.alert.success(faq ? 'Question saved. It’s live in the app.' : 'Question added. It’s live in the app.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(faq: Faq): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete this question?', message: `“${faq.question}” disappears from the app. This can’t be undone.`,
      confirmLabel: 'Delete question', cancelLabel: 'Keep it', tone: 'danger',
    });
    if (!ok) return;
    await this.pageService.removeFaq(faq.id);
    this.data.set(await this.pageService.faqs());
    this.editing.set(undefined);
    this.alert.success('Question deleted.');
  }

  async drop(groupId: string, e: CdkDragDrop<Faq[]>): Promise<void> {
    if (e.previousIndex !== e.currentIndex) await this.saveOrder(groupId, e.previousIndex, e.currentIndex);
  }

  /** Keyboard alternative to dragging. */
  async moveWithKeys(e: KeyboardEvent, groupId: string, i: number, count: number): Promise<void> {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
    if (to < 0 || to >= count) return;
    e.preventDefault();
    const id = (e.target as HTMLElement).id;
    await this.saveOrder(groupId, i, to);
    setTimeout(() => document.getElementById(id)?.focus());
  }

  private async saveOrder(groupId: string, from: number, to: number): Promise<void> {
    const ids = this.data().faqs.filter(f => f.groupId === groupId).map(f => f.id);
    moveItemInArray(ids, from, to);
    this.data.set(await this.pageService.reorderFaqs(groupId, ids));
  }
}
