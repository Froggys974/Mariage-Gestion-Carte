import type { APIRoute } from 'astro';
import { applyProviderStatus, mapWhatsAppStatus } from '~/features/messaging/worker-core';
import { safeEqual } from '~/lib/auth/session';
import { getDb } from '~/lib/db/client';
import { getEnv } from '~/lib/env';
import { logger } from '~/lib/logger';
import { verifyMetaSignature } from '~/lib/messaging/providers';

/** Vérification du webhook par Meta (GET hub.challenge). */
export const GET: APIRoute = ({ url }) => {
  const env = getEnv();
  const ok =
    url.searchParams.get('hub.mode') === 'subscribe' &&
    Boolean(env.WHATSAPP_VERIFY_TOKEN) &&
    safeEqual(url.searchParams.get('hub.verify_token') ?? '', env.WHATSAPP_VERIFY_TOKEN ?? '');
  return ok
    ? new Response(url.searchParams.get('hub.challenge') ?? '', { headers: { 'content-type': 'text/plain' } })
    : new Response('forbidden', { status: 403 });
};

interface StatusEvent {
  id?: string;
  status?: string;
  errors?: Array<{ title?: string; code?: number }>;
}
interface Payload {
  entry?: Array<{ changes?: Array<{ value?: { statuses?: StatusEvent[] } }> }>;
}

/** Statuts envoyé / délivré / lu / échec → send_log. La signature X-Hub-Signature-256 est obligatoire. */
export const POST: APIRoute = async ({ request }) => {
  const secret = getEnv().WHATSAPP_APP_SECRET;
  const raw = await request.text();
  if (!secret || !verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
    logger.warn('webhook WhatsApp : signature invalide');
    return new Response('invalid signature', { status: 401 });
  }
  let body: Payload;
  try {
    body = JSON.parse(raw) as Payload;
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const db = getDb();
  let updated = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const st of change.value?.statuses ?? []) {
        const status = st.status ? mapWhatsAppStatus(st.status) : null;
        if (!st.id || !status) continue;
        const err = st.errors?.[0];
        updated += await applyProviderStatus(
          db,
          st.id,
          status,
          err ? `${err.code ?? ''} ${err.title ?? ''}`.trim() : undefined,
        );
      }
    }
  }
  logger.info({ updated }, 'webhook WhatsApp');
  return new Response('ok');
};
