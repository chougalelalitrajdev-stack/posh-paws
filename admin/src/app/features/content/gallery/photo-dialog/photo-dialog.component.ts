import { Component, ChangeDetectionStrategy, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { GalleryCategory, GalleryPhoto } from '../../../../core/models/gallery.model';
import { GalleryService } from '../../../../core/services/gallery.service';
import { errorMessage } from '../../../../core/utils/error.utils';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SwitchComponent } from '../../../../shared/components/switch/switch.component';

/** Caption, category and visibility of one gallery photo. */
@Component({
  selector: 'pp-photo-dialog',
  imports: [ReactiveFormsModule, ModalComponent, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './photo-dialog.component.html',
  styleUrl: './photo-dialog.component.scss',
})
export class PhotoDialogComponent implements OnInit {
  private gallery = inject(GalleryService);

  readonly photo = input.required<GalleryPhoto>();
  readonly categories = input.required<GalleryCategory[]>();
  readonly closed = output<void>();
  readonly saved = output<GalleryPhoto>();
  readonly deleted = output<GalleryPhoto>();

  protected form = inject(NonNullableFormBuilder).group({
    caption: [''],
    categoryId: [''],
    pet: [''],
    visible: [false],
  });
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    const { caption, categoryId, pet, visible } = this.photo();
    this.form.setValue({ caption, categoryId, pet, visible });
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.gallery.update(this.photo().id, { ...this.form.getRawValue(), imageUrl: this.photo().imageUrl })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: saved => this.saved.emit(saved), error: e => this.error.set(errorMessage(e)) });
  }
}
