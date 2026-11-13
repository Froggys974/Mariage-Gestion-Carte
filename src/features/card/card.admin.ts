/** Écriture de la carte et des réglages (onglet « Modifier la carte »). */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DbOrTx } from '~/lib/db/client';
import { cardSettings, siteSettings, type CardSettings, type SiteSettings } from '~/lib/db/schema';
import { getCardSettings, getSiteSettings } from './card.service';
import { photoSources } from './photo';
import { DEFAULT_FRAME, FRAME, normalizeFrame, PHOTO_SHAPES, type PhotoFrame } from './photo-frame';

const text = (max: number) => z.string().trim().min(1).max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const cardBody = z.object({
  names: text(80),
  date: text(40),
  place: text(200),
  ceremony: text(20),
  reception: text(20),
  message: text(400),
  expectedUpdatedAt: z.iso.datetime().optional(),
});

export const settingsBody = z.object({
  rsvpDeadline: date,
  publicRsvpEnabled: z.boolean(),
  purgeAt: date,
});

export type CardInput = z.infer<typeof cardBody>;

/** Cadrage de la photo (onglet « Modifier la carte »). */
export const frameBody = z.object({
  shape: z.enum(PHOTO_SHAPES),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(FRAME.ZOOM_MIN).max(FRAME.ZOOM_MAX),
});

export async function setPhotoFrame(db: DbOrTx, frame: PhotoFrame): Promise<CardSettings> {
  await getCardSettings(db);
  const [row] = await db
    .update(cardSettings)
    .set({ photoFrame: normalizeFrame(frame), updatedAt: new Date() })
    .where(eq(cardSettings.id, 1))
    .returning();
  return row!;
}

export class CardConflictError extends Error {}

export async function updateCard(db: DbOrTx, input: CardInput): Promise<CardSettings> {
  const current = await getCardSettings(db);
  if (
    input.expectedUpdatedAt &&
    current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()
  ) {
    throw new CardConflictError();
  }
  const [row] = await db
    .update(cardSettings)
    .set({
      names: input.names,
      dateLabel: input.date,
      place: input.place,
      ceremonyTime: input.ceremony,
      receptionTime: input.reception,
      message: input.message,
      updatedAt: new Date(),
    })
    .where(eq(cardSettings.id, 1))
    .returning();
  return row!;
}

export async function setCardImage(
  db: DbOrTx,
  field: 'photoKey' | 'namesImageKey',
  key: string | null,
): Promise<{ previous: string | null; card: CardSettings }> {
  const current = await getCardSettings(db);
  const [row] = await db
    .update(cardSettings)
    .set({
      [field]: key,
      // nouvelle photo : cadrage centré, la forme choisie est gardée
      ...(field === 'photoKey' && key
        ? { photoFrame: { ...DEFAULT_FRAME, shape: normalizeFrame(current.photoFrame).shape } }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(cardSettings.id, 1))
    .returning();
  return { previous: current[field], card: row! };
}

export async function updateSiteSettings(
  db: DbOrTx,
  s: { rsvpDeadline: Date; publicRsvpEnabled: boolean; purgeAt: Date },
): Promise<SiteSettings> {
  await getSiteSettings(db);
  const [row] = await db
    .update(siteSettings)
    .set({ ...s, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  return row!;
}

/** Données de l'éditeur (îlot CardEditor). */
export function editorData(c: CardSettings, s: SiteSettings) {
  return {
    card: {
      names: c.names,
      date: c.dateLabel,
      place: c.place,
      ceremony: c.ceremonyTime,
      reception: c.receptionTime,
      message: c.message,
      photo: photoSources(c.photoKey),
      frame: normalizeFrame(c.photoFrame),
      updatedAt: c.updatedAt.toISOString(),
    },
    settings: {
      rsvpDeadline: s.rsvpDeadline.toISOString(),
      publicRsvpEnabled: s.publicRsvpEnabled,
      purgeAt: s.purgeAt.toISOString(),
      purgedAt: s.purgedAt?.toISOString() ?? null,
    },
  };
}
export type EditorData = ReturnType<typeof editorData>;

export async function loadEditorData(db: DbOrTx): Promise<EditorData> {
  return editorData(await getCardSettings(db), await getSiteSettings(db));
}
