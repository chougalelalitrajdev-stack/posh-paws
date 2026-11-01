import { TemplateField, TemplateValues } from '../models/template.model';

// WhatsApp texts come from Business › Message templates (TemplateService.render).

/** "Ananya Desai" → "Ananya": templates greet customers by first name. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** Fills the {fields} in a template. Fields without a value stay as {field}. */
export function fillTemplate(body: string, values: TemplateValues): string {
  return body.replace(/\{([a-z_]+)\}/g, (match, field: string) => values[field as TemplateField] ?? match);
}
