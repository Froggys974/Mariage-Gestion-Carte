import type { APIRoute } from 'astro';
import { adminRoute, csvResponse } from '~/features/admin/admin.http';
import { catererCsv, catererRows } from '~/features/admin/invitations.service';
import { getDb } from '~/lib/db/client';

export const GET: APIRoute = () =>
  adminRoute('export-caterer', async () =>
    csvResponse(catererCsv(await catererRows(getDb())), 'traiteur.csv'),
  );
