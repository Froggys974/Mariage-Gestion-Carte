import type { APIRoute } from 'astro';
import { idList } from '~/features/admin/admin.schema';
import { adminRoute } from '~/features/admin/admin.http';
import { computeKpis, deleteInvitations } from '~/features/admin/invitations.service';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

/** Suppression groupée. */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request, idList);
  if (!body.ok) return body.response;
  return adminRoute('bulk-delete', async () => ({
    deleted: await deleteInvitations(getDb(), body.data.ids),
    kpis: await computeKpis(getDb()),
  }));
};
