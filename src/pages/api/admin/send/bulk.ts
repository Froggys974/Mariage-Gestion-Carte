import type { APIRoute } from 'astro';
import { bulkSendBody } from '~/features/admin/admin.schema';
import { adminRoute } from '~/features/admin/admin.http';
import { queueBulk } from '~/features/messaging/send.service';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

/** Envoi groupé : mis en file, le worker envoie à 1 message par seconde. */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request, bulkSendBody);
  if (!body.ok) return body.response;
  return adminRoute('bulk-send', () => queueBulk(getDb(), body.data.ids, body.data.channel));
};
