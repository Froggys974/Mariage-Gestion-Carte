/**
 * Mise en file des envois (email, WhatsApp) et traces des envois manuels (lien copié, wa.me).
 * Le worker (src/worker) traite la file à 1 envoi par seconde.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DbOrTx } from '~/lib/db/client';
import { invitation, messageJob, sendLog, type JobPayload, type SendLog } from '~/lib/db/schema';

export type QueueChannel = 'email' | 'whatsapp';
export type Purpose = SendLog['purpose'];

export async function queueSend(
  db: DbOrTx,
  invitationId: string,
  channel: QueueChannel,
  purpose: Purpose,
  payload: JobPayload = {},
): Promise<SendLog> {
  const [log] = await db
    .insert(sendLog)
    .values({ invitationId, channel, purpose, status: 'queued' })
    .returning();
  await db.insert(messageJob).values({ sendLogId: log!.id, payload });
  return log!;
}

/** Statut « envoyé » et date de premier envoi, au premier envoi réussi. */
export async function markInvitationSent(db: DbOrTx, invitationId: string, purpose: Purpose): Promise<void> {
  if (purpose !== 'invitation' && purpose !== 'relance') return;
  await db
    .update(invitation)
    .set({
      firstSentAt: sql`coalesce(${invitation.firstSentAt}, now())`,
      status: sql`case when ${invitation.status} = 'not_sent' then 'sent'::invitation_status else ${invitation.status} end`,
    })
    .where(eq(invitation.id, invitationId));
}

/** Lien copié ou envoyé à la main par wa.me : on garde une trace (canal « lien »). */
export async function logManualSend(db: DbOrTx, invitationId: string): Promise<SendLog> {
  const [log] = await db
    .insert(sendLog)
    .values({ invitationId, channel: 'lien', purpose: 'invitation', status: 'sent', sentAt: new Date() })
    .returning();
  await markInvitationSent(db, invitationId, 'invitation');
  return log!;
}

/** Envoi groupé : seulement aux invitations qui ont un contact pour ce canal. */
export async function queueBulk(
  db: DbOrTx,
  ids: string[],
  channel: QueueChannel,
): Promise<{ queued: number; skipped: number }> {
  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      phone: invitation.phoneE164,
      status: invitation.status,
    })
    .from(invitation)
    .where(and(inArray(invitation.id, ids), eq(invitation.kind, 'guest')));
  let queued = 0;
  for (const r of rows) {
    if (channel === 'email' ? !r.email : !r.phone) continue;
    await queueSend(db, r.id, channel, r.status === 'not_sent' ? 'invitation' : 'relance');
    queued++;
  }
  return { queued, skipped: ids.length - queued };
}
