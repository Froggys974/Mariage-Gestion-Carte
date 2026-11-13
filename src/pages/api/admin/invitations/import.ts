import type { APIRoute } from 'astro';
import { importBody } from '~/features/admin/admin.schema';
import { adminRoute } from '~/features/admin/admin.http';
import { importCsv } from '~/features/admin/invitations.service';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

/** Import CSV : dryRun=true pour l'aperçu, false pour importer. */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request, importBody, 2_500_000);
  if (!body.ok) return body.response;
  return adminRoute('import', () => importCsv(getDb(), body.data.csv, body.data.dryRun));
};
