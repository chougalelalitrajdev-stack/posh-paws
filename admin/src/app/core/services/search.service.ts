import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { SearchResults } from '../models/search.model';

/** Top-bar search across customers, pets and booking IDs. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private http = inject(HttpClient);

  /** An Observable so typing can cancel the previous search (switchMap). */
  search(q: string): Observable<SearchResults> {
    return this.http.get<SearchResults>(API.search, { params: { q } });
  }
}
