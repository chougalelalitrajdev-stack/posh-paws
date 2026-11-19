// The customer app's content, managed in the admin (Content › Banners, Gallery, Pages & FAQs).
// Every text here is plain text: pages show it with {{ }} (never as HTML), so nothing in it can run as code.

export type BannerPlacement = 'home_hero' | 'home_promo' | 'services' | 'membership';

/** App pages a banner's button can open (never an outside address). */
export type AppLink = 'home' | 'services' | 'book' | 'membership' | 'gallery' | 'about';

/** GET /banners: the banner each placement shows now. */
export interface Banner {
  id: string;
  placement: BannerPlacement;
  title: string;
  subtitle: string;
  buttonText: string;
  link: AppLink;
  /** Portrait image for phones; the wide one is for tablets and desktops. */
  imageUrl: string | null;
  desktopImageUrl: string | null;
}

export interface GalleryCategory {
  id: string;
  name: string;
}

export interface GalleryPhoto {
  id: string;
  imageUrl: string;
  caption: string;
  categoryId: string;
  /** Pet or breed, e.g. "Golden Retriever". */
  pet: string;
}

/** GET /gallery: shown photos in order, and the categories that have some. */
export interface GalleryData {
  categories: GalleryCategory[];
  photos: GalleryPhoto[];
}

export type PageKey = 'home' | 'about' | 'terms' | 'privacy';

/** A section's words. `body` is plain text: a blank line starts a new paragraph. */
export interface PageSection {
  id: string;
  heading: string;
  body: string;
}

/** GET /pages/{key}: a page's published, visible sections. */
export interface SitePage {
  key: PageKey;
  title: string;
  sections: PageSection[];
}

export interface FaqGroup {
  id: string;
  name: string;
  /** App pages that show the group, e.g. "Services, Booking". */
  shownOn: string;
}

export interface Faq {
  id: string;
  groupId: string;
  question: string;
  answer: string;
}

/** GET /faqs */
export interface FaqData {
  groups: FaqGroup[];
  faqs: Faq[];
}
