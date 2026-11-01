import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { GalleryBulkAction, GalleryData, GalleryPhoto, GalleryPhotoDraft } from '../models/gallery.model';

/** Photos on the customer app's Gallery page. */
@Injectable({ providedIn: 'root' })
export class GalleryService {
  private http = inject(HttpClient);

  load(): Observable<GalleryData> {
    return this.http.get<GalleryData>(API.gallery);
  }

  /** Adds an uploaded photo. It starts hidden. */
  add(imageUrl: string, categoryId: string, caption: string): Observable<GalleryPhoto> {
    return this.http.post<GalleryPhoto>(API.gallery, { imageUrl, categoryId, caption });
  }

  /** The photo dialog shows errors itself. */
  update(id: string, draft: GalleryPhotoDraft): Observable<GalleryPhoto> {
    return this.http.put<GalleryPhoto>(`${API.gallery}/${id}`, draft, { context: withoutErrorAlert() });
  }

  bulk(action: GalleryBulkAction): Observable<GalleryData> {
    return this.http.post<GalleryData>(`${API.gallery}/bulk`, action);
  }

  /** `ids` are the photos being reordered (one category, or all), in their new order. */
  reorder(ids: string[]): Observable<GalleryData> {
    return this.http.put<GalleryData>(`${API.gallery}/order`, { ids });
  }

  /** Replaces the category list (new ones have no id). The dialog shows errors itself. */
  saveCategories(categories: { id?: string; name: string }[]): Observable<GalleryData> {
    return this.http.put<GalleryData>(`${API.gallery}/categories`, { categories }, { context: withoutErrorAlert() });
  }
}
