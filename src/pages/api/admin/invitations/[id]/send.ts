import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { sendBody } from '~/features/admin/admin.schema';
import { adminRoute } from '~/features/admin/admin.http';
import { getAdminInvitation } from '~/features/admin/invitations.service';
import { logManualSend, queueSend } from '~/features/messaging/send.service';
import { getDb } from '~/lib/db/client';
import { invitation } from '~/lib/db/schema';
import { getEnv } from '~/lib/env';
import { problem, readJson } from '~/lib/http';

/** Envoi unitaire : email / WhatsApp (file d'attente) ou trace d'un envoi manuel (lien copié, wa.me). */
export const POST: APIRoute = async ({ params, request }) => {
  if (!z.uuid().safeParse(params.id).success) return problem(404, 'not_found');
  const body = await readJson(request, sendBody);
  if (!body.ok) return body.response;
  const db = getDb();
  const [inv] = await db
    .select()
    .from(invitation)
    .where(and(eq(invitation.id, params.id!), eq(invitation.kind, 'guest')));
  if (!inv) return problem(404, 'not_found');
  const { channel } = body.data;
  if ((channel === 'email' && !inv.email) || (channel === 'whatsapp' && !inv.phoneE164)) {
    return problem(400, 'no_contact');
  }
  return adminRoute('send', async () => {
    if (channel === 'email' || channel === 'whatsapp') {
      await queueSend(db, inv.id, channel, inv.status === 'not_sent' ? 'invitation' : 'relance');
    } else {
      await logManualSend(db, inv.id);
    }
    return { invitation: await getAdminInvitation(db, inv.id, getEnv().PUBLIC_URL) };
  });
};
