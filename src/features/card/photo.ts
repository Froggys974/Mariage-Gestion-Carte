/** Variantes de la photo de la carte (générées par sharp, voir src/lib/storage/images.ts). */
import type { BootPhoto } from '../invitation/boot';

export const PHOTO_WIDTHS = [400, 800, 1200] as const;
export const PHOTO_FORMATS = ['avif', 'webp', 'jpg'] as const;
export type PhotoFormat = (typeof PHOTO_FORMATS)[number];

/** Clé de stockage d'une variante : card/photo-<id>_<w>x<h>-800.webp */
export function photoVariantKey(base: string, width: number, format: PhotoFormat): string {
  return `${base}-${width}.${format}`;
}

export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

/** Les dimensions d'origine sont encodées dans la clé de base : card/photo-<id>_<w>x<h> */
export function photoDims(base: string): { width: number; height: number } {
  const m = /_(\d+)x(\d+)$/.exec(base);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 1200, height: 800 };
}

export function photoSources(base: string | null): BootPhoto | null {
  if (!base) return null;
  const srcset = (f: PhotoFormat) =>
    PHOTO_WIDTHS.map((w) => `${mediaUrl(photoVariantKey(base, w, f))} ${w}w`).join(', ');
  return {
    avif: srcset('avif'),
    webp: srcset('webp'),
    fallback: mediaUrl(photoVariantKey(base, 800, 'jpg')),
    ...photoDims(base),
  };
}
