import type { APIRoute } from 'astro';
import { adminRoute } from '~/features/admin/admin.http';
import { programmeBody, updateProgramme } from '~/features/programme/programme.service';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

/** Enregistre le programme de la journée (onglet « Programme »). */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readJson(request, programmeBody);
  if (!body.ok) return body.response;
  return adminRoute('programme', async () => ({ items: await updateProgramme(getDb(), body.data.items) }));
};
