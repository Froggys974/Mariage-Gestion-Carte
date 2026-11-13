import type { APIRoute } from 'astro';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { queueSend } from '~/features/messaging/send.service';
import { getDb } from '~/lib/db/client';
import { invitation } from '~/lib/db/schema';
import { getEnv } from '~/lib/env';
import { clientIp, json, readJson } from '~/lib/http';
import { logger } from '~/lib/logger';
import { normalizePhone } from '~/lib/phone';
import { createDbLimiter, hashKey, LIMITS } from '~/lib/rate-limit';

const body = z.object({ contact: z.string().trim().min(3).max(200) });

/**
 * « Lien perdu ? » : renvoie le lien personnel au contact de l'invitation.
 * Réponse TOUJOURS identique (aucune information sur la liste des invités).
 * Limite : 3 demandes par heure par contact et par IP.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const same = json({ ok: true });
  const parsed = await readJson(request, body);
  if (!parsed.ok) return same;
  const env = getEnv();
  const db = getDb();
  const raw = parsed.data.contact;
  const isEmail = raw.includes('@');
  const contact = isEmail ? raw.toLowerCase() : normalizePhone(raw);
  if (!contact) return same;

  const limiter = createDbLimiter(db);
  const ip = clientIp(request, clientAddress, env.TRUST_PROXY);
  const [byIp, byContact] = await Promise.all([
    limiter.hit(hashKey('lost-ip', ip), LIMITS.LOST_LINK),
    limiter.hit(hashKey('lost-contact', contact), LIMITS.LOST_LINK),
  ]);
  if (!byIp.allowed || !byContact.allowed) {
    logger.warn('lien perdu : limite atteinte');
    return same;
  }
  const [inv] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.kind, 'guest'),
        isEmail ? sql`lower(${invitation.email}) = ${contact}` : eq(invitation.phoneE164, contact),
      ),
    )
    .limit(1);
  if (inv) await queueSend(db, inv.id, isEmail ? 'email' : 'whatsapp', 'lien_perdu');
  logger.info({ found: Boolean(inv) }, 'lien perdu : demande');
  return same;
};
