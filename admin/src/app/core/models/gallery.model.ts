export interface GalleryCategory {
  id: string;
  name: string;
  /** Worked out by the server. */
  photoCount: number;
}

/** A photo on the app's Gallery page (Content › Gallery). */
export interface GalleryPhoto {
  id: string;
  imageUrl: string;
  caption: string;
  categoryId: string;
  /** Pet or breed shown under the caption, e.g. "Golden Retriever". */
  pet: string;
  /** Hidden photos stay here but don't show in the app. New uploads start hidden. */
  visible: boolean;
}

/** GET /admin/gallery. Photos are in display order. */
export interface GalleryData {
  categories: GalleryCategory[];
  photos: GalleryPhoto[];
}

export type GalleryPhotoDraft = Omit<GalleryPhoto, 'id'>;

/** POST /admin/gallery/bulk: one action on several photos. */
export type GalleryBulkAction =
  | { action: 'show' | 'hide' | 'delete'; ids: string[] }
  | { action: 'move'; ids: string[]; categoryId: string };
