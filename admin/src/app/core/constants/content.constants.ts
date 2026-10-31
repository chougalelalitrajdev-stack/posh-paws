import { AppLink, BannerPlacement } from '../models/banner.model';

export const BANNER_PLACEMENTS: { value: BannerPlacement; label: string }[] = [
  { value: 'home_hero', label: 'Home hero' },
  { value: 'home_promo', label: 'Home promo strip' },
  { value: 'services', label: 'Services page' },
  { value: 'membership', label: 'Membership page' },
];

/** Customer app pages a banner button can open, with their paths in the customer app. */
export const APP_LINKS: { value: AppLink; label: string; path: string }[] = [
  { value: 'book', label: 'Book a slot', path: '/book' },
  { value: 'services', label: 'Services', path: '/services' },
  { value: 'membership', label: 'Membership', path: '/membership' },
  { value: 'gallery', label: 'Gallery', path: '/gallery' },
  { value: 'about', label: 'About', path: '/about' },
  { value: 'home', label: 'Home', path: '/' },
];

export const BANNER_TITLE_MAX = 48;

/** Longest side of uploaded images, in px. Kept small while photos are stored in the demo's browser storage. */
export const IMAGE_SIZES = { gallery: 1000, bannerPhone: 1080, bannerDesktop: 1600 };
