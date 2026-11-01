import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { MessageTemplate, TemplateKey, TemplateValues } from '../models/template.model';
import { fillTemplate } from '../utils/message.utils';

/** WhatsApp message templates, loaded once and shared; screens fill them in with render(). */
@Injectable({ providedIn: 'root' })
export class TemplateService {
  private http = inject(HttpClient);

  private readonly _templates = signal<MessageTemplate[]>([]);
  private loaded = false;
  private loading$: Observable<void> | null = null;

  readonly templates = this._templates.asReadonly();

  /** Loads once: later calls complete straight away, and calls while loading share one request. */
  load(): Observable<void> {
    if (this.loaded) return of(undefined);
    this.loading$ ??= this.http.get<MessageTemplate[]>(API.templates).pipe(
      tap(list => {
        this._templates.set(list);
        this.loaded = true;
      }),
      map(() => undefined),
      finalize(() => (this.loading$ = null)),
      shareReplay(1),
    );
    return this.loading$;
  }

  /** The message for one customer. Empty until the templates have loaded. */
  render(key: TemplateKey, values: TemplateValues): string {
    const t = this._templates().find(x => x.key === key);
    return t ? fillTemplate(t.body, values) : '';
  }

  /** The editor shows errors itself. */
  save(key: TemplateKey, body: string, autoSend: boolean): Observable<MessageTemplate> {
    return this.http.put<MessageTemplate>(`${API.templates}/${key}`, { body, autoSend }, { context: withoutErrorAlert() }).pipe(
      tap(saved => this._templates.update(list => list.map(t => (t.key === key ? saved : t)))),
    );
  }
}
