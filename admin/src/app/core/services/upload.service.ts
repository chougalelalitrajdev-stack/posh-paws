import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { resizeImage } from '../utils/image.utils';

/** Uploads images (service photos, gallery, banners). Resizes them in the browser first. */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);

  /** Emits the stored image's URL. The caller shows errors inline (a bad file errors before any request). */
  uploadImage(file: File, maxSide = 1600): Observable<string> {
    return from(resizeImage(file, maxSide)).pipe(
      switchMap(blob => {
        const body = new FormData();
        body.append('file', blob, file.name.replace(/\.[^.]+$/, '.jpg'));
        return this.http.post<{ url: string }>(API.uploads, body, { context: withoutErrorAlert() });
      }),
      map(res => res.url),
    );
  }
}
