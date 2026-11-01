/** Where a banner shows in the customer app. The first live banner in each spot is shown. */
export type BannerPlacement = 'home_hero' | 'home_promo' | 'services' | 'membership';

/** Customer app pages a banner's button can open. */
export type AppLink = 'home' | 'services' | 'book' | 'membership' | 'gallery' | 'about';

export type BannerStatus = 'live' | 'scheduled' | 'paused' | 'ended';

/** A promo banner (Content › Banners). */
export interface Banner {
  id: string;
  placement: BannerPlacement;
  title: string;
  subtitle: string;
  buttonText: string;
  link: AppLink;
  /** Portrait image for phones. */
  imageUrl?: string;
  /** Wide image for tablets and desktops. */
  desktopImageUrl?: string;
  /** YYYY-MM-DD */
  startsOn: string;
  /** null = no end date. */
  endsOn: string | null;
  paused: boolean;
  /** Worked out by the server from the dates and `paused`. */
  status: BannerStatus;
}

/** Body of POST /admin/banners and PUT /admin/banners/{id}. */
export type BannerDraft = Omit<Banner, 'id' | 'paused' | 'status'>;
