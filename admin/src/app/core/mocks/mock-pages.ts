import { CATALOG_EDIT_ROLES } from '../constants/app.constants';
import { Faq, FaqData, FaqDraft, PageSection, SitePage } from '../models/page.model';
import { MockError, MockRequest, NO_ROUTE, db, reorderSubset, requireRole, requireStaff, route, save } from './mock-db';

const MAX_BODY = 4000;

/** Page text with draft → publish, and FAQs (Content › Pages & FAQs). */
export function handlePages(r: MockRequest): unknown {
  let m: string[] | null;
  if (r.method !== 'GET' && /^\/(pages|faqs)\b/.test(r.path)) requireRole(r, CATALOG_EDIT_ROLES);
  if ((m = route(r, 'GET', /^\/pages$/))) return db().pages;
  if ((m = route(r, 'PUT', /^\/pages\/([^/]+)\/draft$/))) return saveDraft(findPage(m[0]), r.body.sections, requireStaff(r).name);
  if ((m = route(r, 'DELETE', /^\/pages\/([^/]+)\/draft$/))) return discardDraft(findPage(m[0]));
  if ((m = route(r, 'POST', /^\/pages\/([^/]+)\/publish$/))) return publish(findPage(m[0]), requireStaff(r).name);
  if ((m = route(r, 'GET', /^\/faqs$/))) return faqData();
  if ((m = route(r, 'POST', /^\/faqs$/))) return createFaq(r.body);
  if ((m = route(r, 'PUT', /^\/faqs\/order$/))) return reorderFaqs(r.body.groupId, r.body.ids);
  if ((m = route(r, 'PUT', /^\/faqs\/([^/]+)$/))) return updateFaq(findFaq(m[0]), r.body);
  if ((m = route(r, 'DELETE', /^\/faqs\/([^/]+)$/))) return removeFaq(findFaq(m[0]));
  return NO_ROUTE;
}

function findPage(key: string): SitePage {
  const p = db().pages.find(x => x.key === key);
  if (!p) throw new MockError(404, 'Page not found.');
  return p;
}

function cleanSections(page: SitePage, sections: PageSection[]): PageSection[] {
  for (const fixed of page.sections.filter(s => s.fixed)) {
    if (!sections.some(s => s.id === fixed.id)) throw new MockError(400, `The ${fixed.kind} section is part of the page. Hide it instead.`);
  }
  return sections.map((s, i) => {
    const body = s.body?.trim() ?? '';
    if (body.length > MAX_BODY) throw new MockError(400, `Keep each section under ${MAX_BODY} characters.`);
    const known = page.sections.find(x => x.id === s.id);
    return {
      id: s.id || `sec-${Date.now().toString(36)}${i}`, kind: known?.kind ?? 'Text', heading: s.heading?.trim() ?? '', body,
      visible: !!s.visible, fixed: known?.fixed ?? false,
    };
  });
}

function saveDraft(page: SitePage, sections: PageSection[], by: string): SitePage {
  page.draft = cleanSections(page, sections);
  page.draftSavedAt = new Date().toISOString();
  page.draftSavedBy = by;
  save();
  return page;
}

function discardDraft(page: SitePage): SitePage {
  Object.assign(page, { draft: null, draftSavedAt: null, draftSavedBy: null });
  save();
  return page;
}

function publish(page: SitePage, by: string): SitePage {
  if (!page.draft) throw new MockError(409, 'There are no draft changes to publish.');
  Object.assign(page, { sections: page.draft, draft: null, draftSavedAt: null, draftSavedBy: null, publishedAt: new Date().toISOString(), publishedBy: by });
  save();
  return page;
}

// ── FAQs ──────────────────────────────────────────────────────

function faqData(): FaqData {
  return { groups: db().faqGroups, faqs: db().faqs };
}

function findFaq(id: string): Faq {
  const f = db().faqs.find(x => x.id === id);
  if (!f) throw new MockError(404, 'Question not found.');
  return f;
}

function cleanFaq(body: FaqDraft): FaqDraft {
  const question = body.question?.trim();
  const answer = body.answer?.trim();
  if (!question) throw new MockError(400, 'Enter the question.');
  if (!answer) throw new MockError(400, 'Enter the answer.');
  if (!db().faqGroups.some(g => g.id === body.groupId)) throw new MockError(400, 'Pick a group.');
  return { groupId: body.groupId, question, answer };
}

/** New questions go last in their group. */
function createFaq(body: FaqDraft): Faq {
  const faq: Faq = { id: `faq-${Date.now().toString(36)}`, ...cleanFaq(body) };
  const lastInGroup = db().faqs.map(f => f.groupId).lastIndexOf(faq.groupId);
  db().faqs.splice(lastInGroup + 1 || db().faqs.length, 0, faq);
  save();
  return faq;
}

function updateFaq(f: Faq, body: FaqDraft): Faq {
  const moved = body.groupId !== f.groupId;
  Object.assign(f, cleanFaq(body));
  if (moved) {
    // Moving to another group puts it last there.
    db().faqs = db().faqs.filter(x => x !== f);
    const lastInGroup = db().faqs.map(x => x.groupId).lastIndexOf(f.groupId);
    db().faqs.splice(lastInGroup + 1 || db().faqs.length, 0, f);
  }
  save();
  return f;
}

function removeFaq(f: Faq): object {
  db().faqs = db().faqs.filter(x => x !== f);
  save();
  return {};
}

function reorderFaqs(groupId: string, ids: string[]): FaqData {
  if (ids.length !== db().faqs.filter(f => f.groupId === groupId).length || ids.some(id => findFaq(id).groupId !== groupId)) {
    throw new MockError(400, 'The list changed. Reload and try again.');
  }
  db().faqs = reorderSubset(db().faqs, ids);
  save();
  return faqData();
}
