/** Lecture et écriture du programme de la journée (stocké avec la carte, colonne card_settings.programme). */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { programme as texts } from '~/content/fr';
import type { DbOrTx } from '~/lib/db/client';
import { cardSettings, type CardSettings } from '~/lib/db/schema';
import { getCardSettings } from '../card/card.service';
import type { WeddingLabels } from '../wedding/wedding';
import { PROGRAMME, type ProgrammeItem } from './programme';

const required = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default('');

export const programmeBody = z.object({
  items: z
    .array(
      z.object({
        time: required(PROGRAMME.TIME_MAX),
        title: required(PROGRAMME.TITLE_MAX),
        place: optional(PROGRAMME.PLACE_MAX),
        note: optional(PROGRAMME.NOTE_MAX),
      }),
    )
    .min(1)
    .max(PROGRAMME.MAX_ITEMS),
});

/** Programme proposé à l'installation : la cérémonie, puis la réception si une heure est donnée. */
export function defaultProgramme(w: WeddingLabels): ProgrammeItem[] {
  const t = texts.defaultTitles;
  const items: ProgrammeItem[] = [{ time: w.ceremony, title: t.ceremony, place: w.venueWithCity, note: '' }];
  if (w.reception) items.push({ time: w.reception, title: t.reception, place: w.receptionPlace, note: '' });
  return items;
}

/** Programme enregistré ; sinon celui proposé à partir des infos du mariage (ou rien si non configuré). */
export function programmeOf(
  card: Pick<CardSettings, 'programme'>,
  w: WeddingLabels | null = null,
): ProgrammeItem[] {
  const items = card.programme?.length ? card.programme : w ? defaultProgramme(w) : [];
  return items.map((i) => ({ time: i.time, title: i.title, place: i.place, note: i.note }));
}

export async function loadProgramme(db: DbOrTx, w: WeddingLabels | null = null): Promise<ProgrammeItem[]> {
  return programmeOf(await getCardSettings(db), w);
}

export async function updateProgramme(db: DbOrTx, items: ProgrammeItem[]): Promise<ProgrammeItem[]> {
  await getCardSettings(db);
  const [row] = await db
    .update(cardSettings)
    .set({ programme: items })
    .where(eq(cardSettings.id, 1))
    .returning({ programme: cardSettings.programme });
  return programmeOf(row ?? { programme: null });
}
