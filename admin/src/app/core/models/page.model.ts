/** Customer app pages whose words are edited here (Content › Pages & FAQs). */
export type PageKey = 'home' | 'about' | 'terms' | 'privacy';

export interface PageSection {
  id: string;
  /** What the section is on the page, e.g. "How it works". Added sections are "Text". */
  kind: string;
  heading: string;
  /** Plain text. A blank line starts a new paragraph. */
  body: string;
  visible: boolean;
  /** Part of the app's page layout: can be hidden, not removed. */
  fixed: boolean;
}

export interface SitePage {
  key: PageKey;
  title: string;
  /** What customers see now. */
  sections: PageSection[];
  /** Saved but not published yet. */
  draft: PageSection[] | null;
  publishedAt: string;
  publishedBy: string;
  draftSavedAt: string | null;
  draftSavedBy: string | null;
}

export interface FaqGroup {
  id: string;
  name: string;
  /** Customer app pages that show this group, e.g. "Services, Booking". */
  shownOn: string;
}

export interface Faq {
  id: string;
  groupId: string;
  question: string;
  answer: string;
}

/** GET /admin/faqs. Questions are in display order. */
export interface FaqData {
  groups: FaqGroup[];
  faqs: Faq[];
}

export type FaqDraft = Omit<Faq, 'id'>;
