/** Lecture de la carte et des réglages du site (lignes uniques). */
import { eq } from 'drizzle-orm';
import type { DbOrTx } from '~/lib/db/client';
import { ensureSingletons } from '~/lib/db/defaults';
import { cardSettings, siteSettings, type CardSettings, type SiteSettings } from '~/lib/db/schema';
import type { BootCard } from '../invitation/boot';
import { photoSources } from './photo';
import { normalizeFrame } from './photo-frame';

export async function getCardSettings(db: DbOrTx): Promise<CardSettings> {
  let [row] = await db.select().from(cardSettings).where(eq(cardSettings.id, 1));
  if (!row) {
    await ensureSingletons(db);
    [row] = await db.select().from(cardSettings).where(eq(cardSettings.id, 1));
  }
  if (!row) throw new Error('card_settings introuvable');
  return row;
}

export async function getSiteSettings(db: DbOrTx): Promise<SiteSettings> {
  let [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  if (!row) {
    await ensureSingletons(db);
    [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  }
  if (!row) throw new Error('site_settings introuvable');
  return row;
}

export function toBootCard(c: CardSettings): BootCard {
  return {
    names: c.names,
    date: c.dateLabel,
    place: c.place,
    ceremony: c.ceremonyTime,
    reception: c.receptionTime,
    message: c.message,
    photo: photoSources(c.photoKey),
    frame: normalizeFrame(c.photoFrame),
  };
}

/** « Marie-Ange & Jean Luc » → ['Marie-Ange', 'Jean Luc'] (affichage sur 3 lignes avec le « & »). */
export function splitNames(names: string): [string, string | null] {
  const i = names.indexOf('&');
  if (i < 0) return [names.trim(), null];
  return [names.slice(0, i).trim(), names.slice(i + 1).trim()];
}

/** Message : 1re ligne (créole), le reste en italique. */
export function splitMessage(message: string): [string, string] {
  const [first = '', ...rest] = message.split(/\r?\n/);
  return [first.trim(), rest.join(' ').trim()];
}

export function isClosed(settings: SiteSettings, now = new Date()): boolean {
  return now.getTime() > settings.rsvpDeadline.getTime();
}
