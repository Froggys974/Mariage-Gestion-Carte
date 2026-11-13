/**
 * Informations du mariage en base (table `wedding`) : lecture, assistant d'installation, onglet « Mariage ».
 * L'installation prépare aussi la carte, le programme, les réglages des réponses et l'invitation « Les mariés ».
 */
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { admin as adminTexts, card as cardTexts } from '~/content/fr';
import type { DbOrTx } from '~/lib/db/client';
import { ensureSingletons } from '~/lib/db/defaults';
import { cardSettings, guest, invitation, siteSettings, wedding, type Wedding } from '~/lib/db/schema';
import { fromDateInput } from '~/lib/dates';
import { normalizePhone } from '~/lib/phone';
import { generateToken } from '../invitation/token';
import { defaultProgramme } from '../programme/programme.service';
import {
  addMonths,
  PURGE_MONTHS_AFTER,
  WEDDING_LIMITS as L,
  weddingLabels,
  type WeddingInfo,
  type WeddingLabels,
} from './wedding';

const required = (max: number) => z.string().trim().min(1, 'required').max(max);
const optional = (max: number) => z.string().trim().max(max).default('');
const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'required')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T12:00:00Z`)), 'required');
const hhmm = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time');
const email = z
  .string()
  .trim()
  .max(L.EMAIL)
  .pipe(z.email('email'))
  .transform((v) => v.toLowerCase());

export const weddingInput = z.object({
  partner1First: required(L.FIRST),
  partner1Last: required(L.LAST),
  partner2First: required(L.FIRST),
  partner2Last: required(L.LAST),
  weddingDate: ymd,
  ceremonyTime: hhmm,
  receptionTime: z.union([hhmm, z.literal('')]).default(''),
  venueName: required(L.VENUE),
  venueCity: required(L.CITY),
  venueRegion: optional(L.REGION),
  receptionPlace: optional(L.RECEPTION_PLACE),
  contactEmail: email,
  contactPhone: z
    .string()
    .trim()
    .max(40)
    .default('')
    .transform((v, ctx) => {
      if (!v) return '';
      const e164 = normalizePhone(v);
      if (!e164) {
        ctx.addIssue({ code: 'custom', message: 'phone' });
        return z.NEVER;
      }
      return e164;
    }),
  contactPhoneLabel: optional(L.PHONE_LABEL),
  privacyEmail: email,
});

export const setupInput = weddingInput.extend({ rsvpDeadline: ymd });

export type WeddingInput = z.infer<typeof weddingInput>;
export type SetupInput = z.infer<typeof setupInput>;

export class AlreadyConfiguredError extends Error {}

function toInfo(w: Wedding): WeddingInfo {
  return {
    partner1First: w.partner1First,
    partner1Last: w.partner1Last,
    partner2First: w.partner2First,
    partner2Last: w.partner2Last,
    weddingDate: w.weddingDate,
    ceremonyTime: w.ceremonyTime,
    receptionTime: w.receptionTime,
    venueName: w.venueName,
    venueCity: w.venueCity,
    venueRegion: w.venueRegion,
    receptionPlace: w.receptionPlace,
    contactEmail: w.contactEmail,
    contactPhone: w.contactPhone,
    contactPhoneLabel: w.contactPhoneLabel,
    privacyEmail: w.privacyEmail,
  };
}

/** Infos du mariage, ou null tant que l'assistant d'installation n'a pas été rempli. */
export async function getWedding(db: DbOrTx): Promise<WeddingInfo | null> {
  const [row] = await db.select().from(wedding).where(eq(wedding.id, 1));
  return row ? toInfo(row) : null;
}

/** Libellés (noms, dates, lieu…) pour les textes de fr.ts, ou null si le site n'est pas configuré. */
export async function getWeddingLabels(db: DbOrTx): Promise<WeddingLabels | null> {
  const w = await getWedding(db);
  return w ? weddingLabels(w) : null;
}

/** Les deux prénoms sur l'invitation système « Les mariés » (plan de table). */
async function syncCoupleInvitation(db: DbOrTx, w: WeddingInfo): Promise<void> {
  const [couple] = await db.select().from(invitation).where(eq(invitation.kind, 'couple')).limit(1);
  const names = [w.partner1First.trim(), w.partner2First.trim()];
  if (!couple) {
    const [row] = await db
      .insert(invitation)
      .values({
        token: generateToken(),
        kind: 'couple',
        displayName: adminTexts.plan.couple,
        contactFirstName: w.partner1First.trim(),
        contactLastName: w.partner1Last.trim(),
        status: 'submitted',
        maxSeats: 2,
      })
      .returning({ id: invitation.id });
    if (row) {
      await db.insert(guest).values(
        names.map((firstName, position) => ({
          invitationId: row.id,
          firstName,
          lastName: '',
          isPrimary: position === 0,
          position,
        })),
      );
    }
    return;
  }
  await db
    .update(invitation)
    .set({ contactFirstName: w.partner1First.trim(), contactLastName: w.partner1Last.trim() })
    .where(eq(invitation.id, couple.id));
  const guests = await db
    .select({ id: guest.id, position: guest.position })
    .from(guest)
    .where(eq(guest.invitationId, couple.id))
    .orderBy(asc(guest.position));
  for (const g of guests) {
    const firstName = names[g.position];
    if (firstName) {
      await db
        .update(guest)
        .set({ firstName })
        .where(and(eq(guest.id, g.id), eq(guest.invitationId, couple.id)));
    }
  }
}

/** Assistant d'installation : crée le mariage et prépare carte, programme, réglages et « Les mariés ». */
export async function setupWedding(db: DbOrTx, input: SetupInput): Promise<WeddingInfo> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: wedding.id })
      .from(wedding)
      .where(eq(wedding.id, 1))
      .for('update');
    if (existing) throw new AlreadyConfiguredError();
    const { rsvpDeadline, ...info } = input;
    const [row] = await tx
      .insert(wedding)
      .values({ id: 1, ...info })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new AlreadyConfiguredError();
    const w = weddingLabels(info);

    await ensureSingletons(tx);
    await tx
      .update(cardSettings)
      .set({
        names: w.couplePlain,
        dateLabel: w.dateDots,
        place: [w.venueName, [w.venueCity, w.venueRegion].filter(Boolean).join(', ')].join('\n'),
        ceremonyTime: w.ceremony,
        receptionTime: w.reception,
        message: cardTexts.defaultMessage,
        programme: defaultProgramme(w),
        updatedAt: new Date(),
      })
      .where(eq(cardSettings.id, 1));
    await tx
      .update(siteSettings)
      .set({
        rsvpDeadline: fromDateInput(rsvpDeadline, true),
        purgeAt: fromDateInput(addMonths(info.weddingDate, PURGE_MONTHS_AFTER), false),
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, 1));
    await syncCoupleInvitation(tx, info);
    return toInfo(row);
  });
}

/** Onglet « Mariage » : met à jour les infos (la carte, le programme et les dates ont leurs propres onglets). */
export async function updateWedding(db: DbOrTx, input: WeddingInput): Promise<WeddingInfo> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(wedding)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(wedding.id, 1))
      .returning();
    if (!row) throw new Error('not_found');
    await syncCoupleInvitation(tx, input);
    return toInfo(row);
  });
}
