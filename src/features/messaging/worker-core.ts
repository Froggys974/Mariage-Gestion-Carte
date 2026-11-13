/**
 * Traitement de la file d'envoi (table message_job) : un envoi à la fois, réservé avec
 * FOR UPDATE SKIP LOCKED, réessais de plus en plus espacés, statut final dans send_log.
 */
import { and, asc, eq, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import type { Db } from '~/lib/db/client';
import { invitation, messageJob, sendLog, type SendLog } from '~/lib/db/schema';
import { formatDayMonth } from '~/lib/dates';
import { getEnv } from '~/lib/env';
import { logger } from '~/lib/logger';
import { WhatsAppSendError, type EmailProvider, type WhatsAppProvider } from '~/lib/messaging/providers';
import { getCardSettings, getSiteSettings } from '../card/card.service';
import { mediaUrl } from '../card/photo';
import { personalLink } from '../invitation/token';
import { getWeddingLabels } from '../wedding/wedding.service';
import { markInvitationSent } from './send.service';
import { getStorage } from '~/lib/storage/storage';
import { CARD_CID, cardEmail, invitationEmail, lostLinkEmail, otpEmail, type EmailParts } from './templates';

export const MAX_ATTEMPTS = 6;
export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_MAX_MS = 3_600_000;
/** une réservation plus vieille que 5 min est considérée comme abandonnée (worker arrêté) */
export const LOCK_STALE_MS = 5 * 60_000;
const ERROR_MAX = 300;

/** Délai avant le réessai n° attempt (1 = premier échec) : 30 s, 1 min, 2 min, … plafonné à 1 h. */
export function backoffMs(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1), BACKOFF_MAX_MS);
}

export function statusRank(s: SendLog['status']): number {
  return { failed: -1, queued: 0, sent: 1, delivered: 2, read: 3 }[s];
}

export function mapWhatsAppStatus(s: string): SendLog['status'] | null {
  return s === 'sent' || s === 'delivered' || s === 'read' || s === 'failed' ? s : null;
}

/** Événements du webhook Brevo → statut. */
export function mapBrevoEvent(e: string): SendLog['status'] | null {
  if (e === 'delivered') return 'delivered';
  if (e === 'opened' || e === 'unique_opened' || e === 'click') return 'read';
  if (['hard_bounce', 'soft_bounce', 'blocked', 'invalid_email', 'error', 'spam', 'deferred'].includes(e)) {
    return e === 'soft_bounce' || e === 'deferred' ? null : 'failed';
  }
  return null;
}

export interface WorkerDeps {
  email: EmailProvider;
  whatsapp: WhatsAppProvider;
}

type Job = typeof messageJob.$inferSelect;

/** Réserve le prochain envoi dû. */
export async function claimNext(db: Db): Promise<Job | null> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(messageJob)
      .where(
        and(
          lte(messageJob.nextAttemptAt, new Date()),
          or(isNull(messageJob.lockedAt), lt(messageJob.lockedAt, new Date(Date.now() - LOCK_STALE_MS))),
        ),
      )
      .orderBy(asc(messageJob.nextAttemptAt))
      .limit(1)
      .for('update', { skipLocked: true });
    if (!job) return null;
    await tx.update(messageJob).set({ lockedAt: new Date() }).where(eq(messageJob.id, job.id));
    return job;
  });
}

/** Image des noms (créée en enregistrant la carte), ou null : les noms sont alors écrits en texte. */
async function namesImageUrl(db: Db): Promise<string | null> {
  const card = await getCardSettings(db);
  return card.namesImageKey ? getEnv().PUBLIC_URL + mediaUrl(card.namesImageKey) : null;
}

/** Envoie un message ; lève une erreur en cas d'échec (avec `retryable`). */
async function deliver(db: Db, job: Job, deps: WorkerDeps): Promise<{ log: SendLog; messageId: string }> {
  const [log] = await db.select().from(sendLog).where(eq(sendLog.id, job.sendLogId));
  if (!log) throw Object.assign(new Error('send_log absent'), { retryable: false });
  const [inv] = await db.select().from(invitation).where(eq(invitation.id, log.invitationId));
  if (!inv) throw Object.assign(new Error('invitation absente'), { retryable: false });
  const env = getEnv();
  const link = personalLink(env.PUBLIC_URL, inv.token);

  // la carte en image, à l'adresse saisie par l'invité (« Recevoir par email »)
  if (log.channel === 'email' && log.purpose === 'carte') {
    const { to, cardKey } = job.payload;
    if (!to || !cardKey) throw Object.assign(new Error('carte absente'), { retryable: false });
    const w = await getWeddingLabels(db);
    if (!w) throw Object.assign(new Error('mariage non configuré'), { retryable: false });
    const file = await getStorage().get(cardKey);
    if (!file) throw Object.assign(new Error('image de la carte absente'), { retryable: false });
    const parts = cardEmail(w, { first: inv.contactFirstName, namesImageUrl: await namesImageUrl(db) });
    const { messageId } = await deps.email.send({
      to,
      ...parts,
      attachments: [
        // affichée dans le message…
        { filename: w.cardFileName, content: file.data, contentType: 'image/png', cid: CARD_CID },
        // … et jointe, prête à enregistrer ou imprimer
        { filename: w.cardFileName, content: file.data, contentType: 'image/png' },
      ],
    });
    return { log, messageId };
  }

  if (log.channel === 'email') {
    if (!inv.email) throw Object.assign(new Error('pas d’email'), { retryable: false });
    const w = await getWeddingLabels(db);
    if (!w) throw Object.assign(new Error('mariage non configuré'), { retryable: false });
    const settings = await getSiteSettings(db);
    const common = {
      first: inv.contactFirstName,
      link,
      deadlineLabel: formatDayMonth(settings.rsvpDeadline),
      namesImageUrl: await namesImageUrl(db),
      publicUrl: env.PUBLIC_URL,
    };
    let parts: EmailParts;
    if (log.purpose === 'code') {
      if (!job.payload.code) throw Object.assign(new Error('code absent'), { retryable: false });
      parts = otpEmail(w, {
        first: inv.contactFirstName,
        code: job.payload.code,
        namesImageUrl: common.namesImageUrl,
      });
    } else if (log.purpose === 'lien_perdu') parts = lostLinkEmail(w, common);
    else parts = invitationEmail(w, common);
    const { messageId } = await deps.email.send({ to: inv.email, ...parts });
    return { log, messageId };
  }

  if (log.channel === 'whatsapp') {
    if (!inv.phoneE164) throw Object.assign(new Error('pas de téléphone'), { retryable: false });
    const msg =
      log.purpose === 'code'
        ? {
            to: inv.phoneE164,
            template: env.WHATSAPP_OTP_TEMPLATE_NAME,
            lang: env.WHATSAPP_TEMPLATE_LANG,
            bodyParams: [job.payload.code ?? ''],
            buttonParam: job.payload.code ?? '',
          }
        : {
            to: inv.phoneE164,
            template: env.WHATSAPP_TEMPLATE_NAME,
            lang: env.WHATSAPP_TEMPLATE_LANG,
            bodyParams: [inv.contactFirstName, link],
          };
    if (log.purpose === 'code' && !job.payload.code) {
      throw Object.assign(new Error('code absent'), { retryable: false });
    }
    const { messageId } = await deps.whatsapp.sendTemplate(msg);
    return { log, messageId };
  }
  throw Object.assign(new Error('canal non géré'), { retryable: false });
}

/** L'image d'une carte envoyée par email ne sert plus une fois l'envoi terminé. */
async function dropCardImage(job: Job): Promise<void> {
  if (job.payload.cardKey)
    await getStorage()
      .deletePrefix(job.payload.cardKey)
      .catch(() => undefined);
}

/** Traite un envoi réservé. */
export async function processJob(db: Db, job: Job, deps: WorkerDeps): Promise<'sent' | 'retry' | 'failed'> {
  try {
    const { log, messageId } = await deliver(db, job, deps);
    await db
      .update(sendLog)
      .set({
        status: 'sent',
        providerMessageId: messageId,
        sentAt: new Date(),
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(sendLog.id, log.id));
    await db.delete(messageJob).where(eq(messageJob.id, job.id));
    await dropCardImage(job);
    await markInvitationSent(db, log.invitationId, log.purpose);
    return 'sent';
  } catch (err) {
    const attempts = job.attempts + 1;
    const retryable =
      err instanceof WhatsAppSendError ? err.retryable : (err as { retryable?: boolean }).retryable !== false;
    const message = String((err as Error).message ?? err).slice(0, ERROR_MAX);
    if (!retryable || attempts >= MAX_ATTEMPTS) {
      await db
        .update(sendLog)
        .set({ status: 'failed', error: message, updatedAt: new Date() })
        .where(eq(sendLog.id, job.sendLogId));
      await db.delete(messageJob).where(eq(messageJob.id, job.id));
      await dropCardImage(job);
      logger.warn({ sendLogId: job.sendLogId, attempts }, 'envoi abandonné');
      return 'failed';
    }
    await db
      .update(messageJob)
      .set({
        attempts,
        lastError: message,
        lockedAt: null,
        nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        // le code OTP reste jusqu'au succès ou à l'abandon
      })
      .where(eq(messageJob.id, job.id));
    logger.warn({ sendLogId: job.sendLogId, attempts }, 'envoi en échec, nouvel essai prévu');
    return 'retry';
  }
}

export async function processNext(db: Db, deps: WorkerDeps): Promise<boolean> {
  const job = await claimNext(db);
  if (!job) return false;
  await processJob(db, job, deps);
  return true;
}

/** Retours des fournisseurs (webhooks) : le statut ne fait que progresser. */
export async function applyProviderStatus(
  db: Db,
  providerMessageId: string,
  status: SendLog['status'],
  error?: string,
): Promise<number> {
  const ids = [
    providerMessageId,
    providerMessageId.replace(/^<|>$/g, ''),
    `<${providerMessageId.replace(/^<|>$/g, '')}>`,
  ];
  const rows = await db.select().from(sendLog).where(inArray(sendLog.providerMessageId, ids));
  let n = 0;
  for (const row of rows) {
    const upgrade =
      status === 'failed'
        ? statusRank(row.status) < statusRank('delivered')
        : statusRank(status) > statusRank(row.status);
    if (!upgrade) continue;
    const now = new Date();
    await db
      .update(sendLog)
      .set({
        status,
        updatedAt: now,
        ...(status === 'delivered' ? { deliveredAt: now } : {}),
        ...(status === 'read' ? { readAt: now, deliveredAt: row.deliveredAt ?? now } : {}),
        ...(error ? { error: error.slice(0, ERROR_MAX) } : {}),
      })
      .where(eq(sendLog.id, row.id));
    n++;
  }
  return n;
}
