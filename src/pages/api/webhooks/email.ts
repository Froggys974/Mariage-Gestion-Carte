import type { APIRoute } from 'astro';
import { applyProviderStatus, mapBrevoEvent } from '~/features/messaging/worker-core';
import { safeEqual } from '~/lib/auth/session';
import { getDb } from '~/lib/db/client';
import { getEnv } from '~/lib/env';
import { logger } from '~/lib/logger';

interface BrevoEvent {
  event?: string;
  'message-id'?: string;
  reason?: string;
}

/**
 * Webhook de suivi des emails (format Brevo) : /api/webhooks/email?secret=EMAIL_WEBHOOK_SECRET
 * (ou en-tête X-Webhook-Secret). Délivré, ouvert, rejeté → send_log.
 */
export const POST: APIRoute = async ({ request, url }) => {
  const secret = getEnv().EMAIL_WEBHOOK_SECRET;
  const given = url.searchParams.get('secret') ?? request.headers.get('x-webhook-secret') ?? '';
  if (!secret || !safeEqual(given, secret)) return new Response('forbidden', { status: 403 });
  let body: BrevoEvent | BrevoEvent[];
  try {
    body = (await request.json()) as BrevoEvent | BrevoEvent[];
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const db = getDb();
  let updated = 0;
  for (const ev of Array.isArray(body) ? body : [body]) {
    const status = ev.event ? mapBrevoEvent(ev.event) : null;
    if (!status || !ev['message-id']) continue;
    updated += await applyProviderStatus(
      db,
      ev['message-id'],
      status,
      status === 'failed' ? ev.event : undefined,
    );
  }
  logger.info({ updated }, 'webhook email');
  return new Response('ok');
};
