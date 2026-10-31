import { Component, ChangeDetectionStrategy, inject, input, model, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { UploadService } from '../../../core/services/upload.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { IMAGE_TYPES } from '../../../core/utils/image.utils';

/** Drop or browse for one image; uploads it and keeps its URL in `url`. */
@Component({
  selector: 'pp-image-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-upload.component.html',
  styleUrl: './image-upload.component.scss',
})
export class ImageUploadComponent {
  private uploads = inject(UploadService);

  readonly url = model<string | undefined>(undefined);
  readonly label = input('Photo');
  readonly hint = input('JPG or PNG, at least 1200 × 800.');
  readonly disabled = input(false);
  /** Longest side after resizing, in px. */
  readonly maxSide = input(1600);
  /** Shape of the preview, e.g. '4 / 5' for a portrait banner. */
  readonly aspect = input('3 / 2');

  protected readonly accept = IMAGE_TYPES.join(',');
  protected uploading = signal(false);
  protected dragging = signal(false);
  protected error = signal<string | null>(null);

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file && !this.disabled()) void this.upload(file);
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (!this.disabled()) this.dragging.set(true);
  }

  onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.upload(file);
  }

  private async upload(file: File): Promise<void> {
    this.uploading.set(true);
    this.error.set(null);
    try {
      this.url.set(await this.uploads.uploadImage(file, this.maxSide()));
    } catch (e) {
      this.error.set(e instanceof HttpErrorResponse ? errorMessage(e) : e instanceof Error ? e.message : errorMessage(e));
    } finally {
      this.uploading.set(false);
    }
  }
}
