/**
 * Lien public /rsvp (facultatif) : l'invité tape son prénom et son nom, on cherche parmi les invités
 * (pg_trgm + unaccent : tolérant aux accents et aux fautes), puis il confirme avec un code à 6 chiffres
 * envoyé au contact de l'invitation. La liste des invités n'est jamais exposée : la réponse est la même
 * que le nom soit trouvé ou non (défi factice).
 */
import { createHmac, randomInt } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '~/lib/db/client';
import { invitation, otpChallenge } from '~/lib/db/schema';
import { getEnv } from '~/lib/env';
import { LIMITS } from '~/lib/rate-limit';
import { safeEqual } from '~/lib/auth/session';
import { queueSend } from '../messaging/send.service';

export const OTP = {
  DIGITS: 6,
  TTL_MS: 15 * 60_000,
  /** similarité trigramme minimale (0 à 1) */
  MIN_SIMILARITY: 0.45,
  /** écart minimal avec le 2e candidat (sinon : ambigu, on ne choisit pas) */
  MIN_MARGIN: 0.08,
} as const;

export function generateCode(): string {
  return String(randomInt(0, 10 ** OTP.DIGITS)).padStart(OTP.DIGITS, '0');
}

export function hashCode(challengeId: string, code: string): string {
  return createHmac('sha256', getEnv().SESSION_SECRET).update(`${challengeId}:${code}`).digest('base64url');
}

export interface Candidate {
  invitationId: string;
  score: number;
}

/** Choix du meilleur candidat : assez proche, et nettement meilleur que le suivant. */
export function pickCandidate(c: readonly Candidate[]): string | null {
  const [best, second] = c;
  if (!best || best.score < OTP.MIN_SIMILARITY) return null;
  if (second && best.score - second.score < OTP.MIN_MARGIN) return null;
  return best.invitationId;
}

export async function searchCandidates(db: Db, first: string, last: string): Promise<Candidate[]> {
  const q = `${first} ${last}`.trim();
  const rows = await db.execute<{ invitation_id: string; score: number }>(sql`
    with q as (select f_unaccent(lower(${q})) as n),
    names as (
      select g.invitation_id, f_unaccent(lower(g.first_name || ' ' || g.last_name)) as n
        from guest g join invitation i on i.id = g.invitation_id
       where i.kind = 'guest'
      union all
      select i.id, f_unaccent(lower(i.contact_first_name || ' ' || i.contact_last_name))
        from invitation i where i.kind = 'guest'
    )
    select names.invitation_id, max(similarity(names.n, q.n))::float as score
      from names, q
     where names.n % q.n or similarity(names.n, q.n) > 0.3
     group by names.invitation_id
     order by score desc
     limit 2`);
  return rows.map((r) => ({ invitationId: r.invitation_id, score: Number(r.score) }));
}

/** Crée un défi (réel ou factice) et envoie le code si une invitation correspond. */
export async function startChallenge(db: Db, first: string, last: string): Promise<{ challengeId: string }> {
  const invitationId = pickCandidate(await searchCandidates(db, first, last));
  const code = generateCode();
  const [row] = await db
    .insert(otpChallenge)
    .values({ invitationId, codeHash: 'en-attente', expiresAt: new Date(Date.now() + OTP.TTL_MS) })
    .returning({ id: otpChallenge.id });
  const id = row!.id;
  await db
    .update(otpChallenge)
    .set({ codeHash: hashCode(id, code) })
    .where(eq(otpChallenge.id, id));
  if (invitationId) {
    const [inv] = await db
      .select({ email: invitation.email, phone: invitation.phoneE164 })
      .from(invitation)
      .where(eq(invitation.id, invitationId));
    const channel = inv?.email ? 'email' : inv?.phone ? 'whatsapp' : null;
    if (channel) await queueSend(db, invitationId, channel, 'code', { code });
  }
  return { challengeId: id };
}

export type VerifyResult = { ok: true; token: string } | { ok: false; reason: 'bad' | 'locked' };

export async function verifyChallenge(db: Db, challengeId: string, code: string): Promise<VerifyResult> {
  return db.transaction(async (tx) => {
    const [ch] = await tx
      .select()
      .from(otpChallenge)
      .where(and(eq(otpChallenge.id, challengeId), isNull(otpChallenge.consumedAt)))
      .for('update');
    if (!ch || ch.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'bad' };
    if (ch.attempts >= LIMITS.OTP_ATTEMPTS) return { ok: false, reason: 'locked' };
    await tx
      .update(otpChallenge)
      .set({ attempts: ch.attempts + 1 })
      .where(eq(otpChallenge.id, ch.id));
    if (!ch.invitationId || !safeEqual(hashCode(ch.id, code), ch.codeHash)) {
      return { ok: false, reason: ch.attempts + 1 >= LIMITS.OTP_ATTEMPTS ? 'locked' : 'bad' };
    }
    await tx.update(otpChallenge).set({ consumedAt: new Date() }).where(eq(otpChallenge.id, ch.id));
    const [inv] = await tx
      .select({ token: invitation.token })
      .from(invitation)
      .where(eq(invitation.id, ch.invitationId));
    return inv ? { ok: true, token: inv.token } : { ok: false, reason: 'bad' };
  });
}
