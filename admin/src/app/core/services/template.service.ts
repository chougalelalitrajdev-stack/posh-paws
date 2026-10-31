import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { MessageTemplate, TemplateKey, TemplateValues } from '../models/template.model';
import { fillTemplate } from '../utils/message.utils';

/** WhatsApp message templates, loaded once and shared; screens fill them in with render(). */
@Injectable({ providedIn: 'root' })
export class TemplateService {
  private http = inject(HttpClient);

  private readonly _templates = signal<MessageTemplate[]>([]);
  private loading: Promise<void> | null = null;

  readonly templates = this._templates.asReadonly();

  /** Loads once; later calls reuse the same result. */
  load(): Promise<void> {
    this.loading ??= firstValueFrom(this.http.get<MessageTemplate[]>(API.templates))
      .then(list => this._templates.set(list))
      .catch(e => {
        this.loading = null;
        throw e;
      });
    return this.loading;
  }

  /** The message for one customer. Empty until the templates have loaded. */
  render(key: TemplateKey, values: TemplateValues): string {
    const t = this._templates().find(x => x.key === key);
    return t ? fillTemplate(t.body, values) : '';
  }

  /** The editor shows errors itself. */
  async save(key: TemplateKey, body: string, autoSend: boolean): Promise<MessageTemplate> {
    const saved = await firstValueFrom(this.http.put<MessageTemplate>(`${API.templates}/${key}`, { body, autoSend }, { context: withoutErrorAlert() }));
    this._templates.update(list => list.map(t => (t.key === key ? saved : t)));
    return saved;
  }
}
