import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { resizeImage } from '../utils/image.utils';

/** Uploads images (service photos, gallery, banners). Resizes them in the browser first. */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);

  /** Returns the stored image's URL. The caller shows errors inline. */
  async uploadImage(file: File, maxSide = 1600): Promise<string> {
    const blob = await resizeImage(file, maxSide);
    const body = new FormData();
    body.append('file', blob, file.name.replace(/\.[^.]+$/, '.jpg'));
    const res = await firstValueFrom(this.http.post<{ url: string }>(API.uploads, body, { context: withoutErrorAlert() }));
    return res.url;
  }
}
