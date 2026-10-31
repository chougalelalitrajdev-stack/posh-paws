import { CATALOG_EDIT_ROLES } from '../constants/app.constants';
import { TEMPLATE_FIELDS, TEMPLATE_MAX_LENGTH } from '../constants/template.constants';
import { MessageTemplate, TemplateKey } from '../models/template.model';
import { MockError, MockRequest, NO_ROUTE, StoredTemplate, db, requireRole, requireStaff, route, save } from './mock-db';

/** WhatsApp message templates (Business › Message templates). Admins edit; staff read. */
export function handleTemplates(r: MockRequest): unknown {
  let m: string[] | null;
  if ((m = route(r, 'GET', /^\/templates$/))) return db().templates.map(withTrigger);
  if ((m = route(r, 'PUT', /^\/templates\/([^/]+)$/))) {
    requireRole(r, CATALOG_EDIT_ROLES);
    return update(find(m[0] as TemplateKey), r.body, requireStaff(r).name);
  }
  return NO_ROUTE;
}

/** When each template goes out. The timed ones follow Settings › Notifications. */
function trigger(key: TemplateKey): string {
  const n = db().settings.notifications;
  const triggers: Record<TemplateKey, string> = {
    payment_link: 'Sent by staff from a booking',
    booking_confirmed: 'Right after payment',
    booking_reminder: `At ${n.reminderTime} the day before`,
    unpaid_nudge: `${n.unpaidNudgeHours} hours after the link, if unpaid`,
    callback_received: 'When a callback is requested',
    missed_call: 'Sent by staff after no answer',
    plan_payment: 'Sent by staff from Subscriptions',
    plan_renewal: '3 days before renewal; staff can also send it from Subscriptions',
    plan_welcome: 'Right after the first plan payment',
    win_back: 'Sent by staff from Subscriptions',
  };
  return triggers[key];
}

function withTrigger(t: StoredTemplate): MessageTemplate {
  return { ...t, trigger: trigger(t.key) };
}

function find(key: TemplateKey): StoredTemplate {
  const t = db().templates.find(x => x.key === key);
  if (!t) throw new MockError(404, 'Template not found.');
  return t;
}

/** A changed text goes back to WhatsApp for approval before it can be sent automatically. */
function update(t: StoredTemplate, body: { body: string; autoSend: boolean }, by: string): MessageTemplate {
  const text = body.body?.trim();
  if (!text) throw new MockError(400, 'Write the message.');
  if (text.length > TEMPLATE_MAX_LENGTH) throw new MockError(400, `Keep the message under ${TEMPLATE_MAX_LENGTH} characters.`);
  const unknown = [...text.matchAll(/\{([^{}]*)\}/g)].map(x => x[1]).find(f => !TEMPLATE_FIELDS.some(k => k.field === f));
  if (unknown !== undefined) throw new MockError(400, `{${unknown}} isn’t a field. Use the Insert buttons to add one.`);
  if (text !== t.body) t.approval = 'pending';
  Object.assign(t, { body: text, autoSend: t.canAutoSend && !!body.autoSend, updatedAt: new Date().toISOString(), updatedBy: by });
  save();
  return withTrigger(t);
}
