import { Component, ChangeDetectionStrategy, computed, inject, input, model, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize, switchMap, tap } from 'rxjs';
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

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const faq = this.editing();
    this.pageService.saveFaq(this.form.getRawValue(), faq?.id).pipe(
      switchMap(() => this.pageService.faqs()),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: data => {
        this.data.set(data);
        this.editing.set(undefined);
        this.alert.success(faq ? 'Question saved. It’s live in the app.' : 'Question added. It’s live in the app.');
      },
      error: e => this.error.set(errorMessage(e)),
    });
  }

  async remove(faq: Faq): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete this question?', message: `“${faq.question}” disappears from the app. This can’t be undone.`,
      confirmLabel: 'Delete question', cancelLabel: 'Keep it', tone: 'danger',
    });
    if (!ok) return;
    this.pageService.removeFaq(faq.id).pipe(switchMap(() => this.pageService.faqs())).subscribe(data => {
      this.data.set(data);
      this.editing.set(undefined);
      this.alert.success('Question deleted.');
    });
  }

  drop(groupId: string, e: CdkDragDrop<Faq[]>): void {
    if (e.previousIndex !== e.currentIndex) this.saveOrder(groupId, e.previousIndex, e.currentIndex).subscribe();
  }

  /** Keyboard alternative to dragging. Focus returns to the handle once the new order is shown. */
  moveWithKeys(e: KeyboardEvent, groupId: string, i: number, count: number): void {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
    if (to < 0 || to >= count) return;
    e.preventDefault();
    const id = (e.target as HTMLElement).id;
    this.saveOrder(groupId, i, to).subscribe(() => setTimeout(() => document.getElementById(id)?.focus()));
  }

  private saveOrder(groupId: string, from: number, to: number): Observable<FaqData> {
    const ids = this.data().faqs.filter(f => f.groupId === groupId).map(f => f.id);
    moveItemInArray(ids, from, to);
    return this.pageService.reorderFaqs(groupId, ids).pipe(tap(data => this.data.set(data)));
  }
}
