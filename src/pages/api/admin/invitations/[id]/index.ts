import type { APIRoute } from 'astro';
import { z } from 'zod';
import { invitationPatch } from '~/features/admin/admin.schema';
import { adminRoute } from '~/features/admin/admin.http';
import { emailProblem } from '~/features/admin/email-guard';
import {
  deleteInvitations,
  getAdminInvitation,
  updateInvitation,
} from '~/features/admin/invitations.service';
import { getDb } from '~/lib/db/client';
import { getEnv } from '~/lib/env';
import { problem, readJson } from '~/lib/http';

const id = z.uuid();

export const PATCH: APIRoute = async ({ params, request }) => {
  if (!id.safeParse(params.id).success) return problem(404, 'not_found');
  const body = await readJson(request, invitationPatch);
  if (!body.ok) return body.response;
  return adminRoute('update', async () => {
    if (body.data.email) {
      // seule une adresse nouvelle ou modifiée est contrôlée
      const current = await getAdminInvitation(getDb(), params.id!, getEnv().PUBLIC_URL);
      if (current && current.email !== body.data.email) {
        const bad = await emailProblem(body.data.email, body.data.confirmEmail);
        if (bad) return bad;
      }
    }
    await updateInvitation(getDb(), params.id!, body.data);
    return { invitation: await getAdminInvitation(getDb(), params.id!, getEnv().PUBLIC_URL) };
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  if (!id.safeParse(params.id).success) return problem(404, 'not_found');
  return adminRoute('delete', async () => ({ deleted: await deleteInvitations(getDb(), [params.id!]) }));
};
