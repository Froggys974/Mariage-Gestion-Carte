/** Photo de la carte : redimensionnée et convertie avec sharp (AVIF, WebP, JPEG de repli). */
import { randomBytes } from 'node:crypto';
import sharp, { type Metadata, type Sharp } from 'sharp';
import { PHOTO_WIDTHS, photoVariantKey, type PhotoFormat } from '~/features/card/photo';
import { CONTENT_TYPES, type Storage } from './storage';

export const IMAGE = {
  MAX_BYTES: 15 * 1024 * 1024,
  MAX_PIXELS: 60_000_000,
  QUALITY: { avif: 50, webp: 78, jpg: 80 } as Record<PhotoFormat, number>,
} as const;

export class ImageRejectedError extends Error {}

export interface ProcessedPhoto {
  base: string;
  files: Array<{ key: string; data: Buffer; contentType: string }>;
}

export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.length > IMAGE.MAX_BYTES) throw new ImageRejectedError('trop lourde');
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: IMAGE.MAX_PIXELS }).metadata();
  } catch {
    throw new ImageRejectedError('format');
  }
  if (
    !meta.width ||
    !meta.height ||
    !['jpeg', 'png', 'webp', 'heif', 'avif', 'tiff'].includes(meta.format ?? '')
  ) {
    throw new ImageRejectedError('format');
  }
  // les photos de téléphone portent l'orientation dans l'EXIF
  const portrait = (meta.orientation ?? 1) >= 5;
  const width = portrait ? meta.height : meta.width;
  const height = portrait ? meta.width : meta.height;
  const base = `card/photo-${randomBytes(6).toString('hex')}_${width}x${height}`;
  try {
    return { base, files: await renderVariants(input, base) };
  } catch {
    // fichier tronqué ou corrompu après l'en-tête : refus propre (400) plutôt qu'une erreur 500
    throw new ImageRejectedError('format');
  }
}

async function renderVariants(input: Buffer, base: string): Promise<ProcessedPhoto['files']> {
  const files: ProcessedPhoto['files'] = [];
  for (const w of PHOTO_WIDTHS) {
    const pipeline = sharp(input, { limitInputPixels: IMAGE.MAX_PIXELS })
      .rotate()
      .resize({ width: w, withoutEnlargement: true });
    const variants: Array<[PhotoFormat, Sharp]> = [
      ['avif', pipeline.clone().avif({ quality: IMAGE.QUALITY.avif })],
      ['webp', pipeline.clone().webp({ quality: IMAGE.QUALITY.webp })],
      ['jpg', pipeline.clone().jpeg({ quality: IMAGE.QUALITY.jpg, mozjpeg: true })],
    ];
    for (const [fmt, p] of variants) {
      files.push({
        key: photoVariantKey(base, w, fmt),
        data: await p.toBuffer(),
        contentType: CONTENT_TYPES[fmt]!,
      });
    }
  }
  return files;
}

export async function storePhoto(storage: Storage, input: Buffer): Promise<string> {
  const { base, files } = await processPhoto(input);
  await Promise.all(files.map((f) => storage.put(f.key, f.data, f.contentType)));
  return base;
}

/** Image PNG des noms (dessinée dans le navigateur de l'admin), vérifiée et recompressée. */
export async function storeNamesImage(storage: Storage, input: Buffer): Promise<string> {
  if (input.length > 2 * 1024 * 1024) throw new ImageRejectedError('trop lourde');
  let png: Buffer;
  try {
    png = await sharp(input, { limitInputPixels: 4_000_000 }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    throw new ImageRejectedError('format');
  }
  const key = `card/names-${randomBytes(6).toString('hex')}.png`;
  await storage.put(key, png, 'image/png');
  return key;
}
