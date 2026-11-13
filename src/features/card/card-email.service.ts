/**
 * « Recevoir par email » : l'invité demande sa carte (image PNG dessinée par son navigateur) à l'adresse de
 * son choix. Garde-fous : lien personnel valide, 3 envois au plus par invitation, adresse vérifiée, image
 * contrôlée et ré-encodée. L'adresse saisie et l'image ne vivent que le temps de l'envoi (file d'envoi).
 */
import { randomBytes } from 'node:crypto';
import { and, count, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { z } from 'zod';
import type { DbOrTx } from '~/lib/db/client';
import { sendLog } from '~/lib/db/schema';
import { checkMailDomain, type DomainStatus } from '~/lib/email-check';
import type { Storage } from '~/lib/storage/storage';
import { findInvitationByToken } from '../invitation/invitation.service';
import { queueSend } from '../messaging/send.service';
import { PNG } from './client/card-png';

export const CARD_EMAIL = {
  /** envois au plus par invitation (toutes adresses confondues) */
  MAX_PER_INVITATION: 3,
  MAX_BYTES: 6_000_000,
} as const;

export type CardEmailErrorCode = 'not_found' | 'too_many' | 'email' | 'email_domain' | 'image';

export class CardEmailError extends Error {
  constructor(
    readonly code: CardEmailErrorCode,
    readonly extra: Record<string, string> = {},
  ) {
    super(code);
  }
}

const emailSchema = z.string().trim().max(200).pipe(z.email());

/** Combien de cartes ont déjà été demandées avec cette invitation. */
export async function cardEmailsSent(db: DbOrTx, invitationId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(sendLog)
    .where(and(eq(sendLog.invitationId, invitationId), eq(sendLog.purpose, 'carte')));
  return row?.n ?? 0;
}

/** Vérifie l'image : un PNG aux dimensions de la carte ; ré-encodé (aucune donnée cachée ne passe). */
async function cleanCardPng(input: Buffer): Promise<Buffer> {
  if (input.length === 0 || input.length > CARD_EMAIL.MAX_BYTES) throw new CardEmailError('image');
  try {
    const meta = await sharp(input, { limitInputPixels: PNG.W * PNG.H }).metadata();
    if (meta.format !== 'png' || meta.width !== PNG.W || meta.height !== PNG.H) {
      throw new CardEmailError('image');
    }
    return await sharp(input).png({ compressionLevel: 9 }).toBuffer();
  } catch (err) {
    if (err instanceof CardEmailError) throw err;
    throw new CardEmailError('image');
  }
}

export async function requestCardEmail(
  db: DbOrTx,
  storage: Storage,
  input: { token: string; email: string; png: Buffer },
  checkDomain: (email: string) => Promise<DomainStatus> = checkMailDomain,
): Promise<{ to: string; remaining: number }> {
  const inv = await findInvitationByToken(db, input.token);
  if (!inv) throw new CardEmailError('not_found');
  const sent = await cardEmailsSent(db, inv.id);
  if (sent >= CARD_EMAIL.MAX_PER_INVITATION) throw new CardEmailError('too_many');

  const parsed = emailSchema.safeParse(input.email);
  if (!parsed.success) throw new CardEmailError('email');
  const to = parsed.data.toLowerCase();
  if ((await checkDomain(to)) === 'no_mail') {
    throw new CardEmailError('email_domain', { domain: to.slice(to.lastIndexOf('@') + 1) });
  }

  const png = await cleanCardPng(input.png);
  const cardKey = `cards/card-${randomBytes(8).toString('hex')}.png`;
  await storage.put(cardKey, png, 'image/png');
  await queueSend(db, inv.id, 'email', 'carte', { to, cardKey });
  return { to, remaining: CARD_EMAIL.MAX_PER_INVITATION - sent - 1 };
}
