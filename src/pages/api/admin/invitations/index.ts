import type { APIRoute } from 'astro';
import { fieldError, invitationInput } from '~/features/admin/admin.schema';
import { adminRoute } from '~/features/admin/admin.http';
import { emailProblem } from '~/features/admin/email-guard';
import {
  computeKpis,
  createInvitation,
  getAdminInvitation,
  listInvitations,
} from '~/features/admin/invitations.service';
import { queueSend } from '~/features/messaging/send.service';
import { getDb } from '~/lib/db/client';
import { getEnv } from '~/lib/env';
import { problem } from '~/lib/http';
import { whatsappApiEnabled } from '~/lib/messaging/providers';

export const GET: APIRoute = () =>
  adminRoute('list', async () => {
    const db = getDb();
    const [invitations, kpis] = await Promise.all([
      listInvitations(db, getEnv().PUBLIC_URL),
      computeKpis(db),
    ]);
    return { invitations, kpis };
  });

/**
 * « Nouvel envoi » : crée l'invitation et l'envoie : email si présent ; sinon WhatsApp automatique si l'API Meta
 * est configurée ; sinon « wa_me » : le navigateur ouvre WhatsApp avec le message prêt (envoi à la main).
 */
export const POST: APIRoute = async ({ request }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return problem(400, 'bad_json');
  }
  const parsed = invitationInput.safeParse(raw);
  if (!parsed.success) return problem(400, fieldError(parsed.error.issues));
  const bad = await emailProblem(parsed.data.email, parsed.data.confirmEmail);
  if (bad) return bad;
  return adminRoute('create', async () => {
    const db = getDb();
    const inv = await createInvitation(db, parsed.data);
    let channel: 'email' | 'whatsapp' | 'wa_me' | null = null;
    if (parsed.data.send) {
      if (inv.email) channel = 'email';
      else if (inv.phoneE164) channel = whatsappApiEnabled() ? 'whatsapp' : 'wa_me';
      if (channel === 'email' || channel === 'whatsapp') await queueSend(db, inv.id, channel, 'invitation');
    }
    const [created, kpis] = await Promise.all([
      getAdminInvitation(db, inv.id, getEnv().PUBLIC_URL),
      computeKpis(db),
    ]);
    return { invitation: created, kpis, channel };
  });
};
