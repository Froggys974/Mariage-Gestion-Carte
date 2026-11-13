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

export const GET: APIRoute = () =>
  adminRoute('list', async () => {
    const db = getDb();
    const [invitations, kpis] = await Promise.all([
      listInvitations(db, getEnv().PUBLIC_URL),
      computeKpis(db),
    ]);
    return { invitations, kpis };
  });

/** « Nouvel envoi » : crée l'invitation et l'envoie (email si présent, sinon WhatsApp). */
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
    let channel: 'email' | 'whatsapp' | null = null;
    if (parsed.data.send) {
      channel = inv.email ? 'email' : inv.phoneE164 ? 'whatsapp' : null;
      if (channel) await queueSend(db, inv.id, channel, 'invitation');
    }
    const [created, kpis] = await Promise.all([
      getAdminInvitation(db, inv.id, getEnv().PUBLIC_URL),
      computeKpis(db),
    ]);
    return { invitation: created, kpis, channel };
  });
};
