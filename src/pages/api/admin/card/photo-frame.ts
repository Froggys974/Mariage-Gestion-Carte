import type { APIRoute } from 'astro';
import { adminRoute } from '~/features/admin/admin.http';
import { frameBody, loadEditorData, setPhotoFrame } from '~/features/card/card.admin';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

/** Cadrage de la photo : forme, point de cadrage, zoom (la photo d'origine n'est pas modifiée). */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readJson(request, frameBody);
  if (!body.ok) return body.response;
  return adminRoute('photo-frame', async () => {
    const db = getDb();
    await setPhotoFrame(db, body.data);
    return loadEditorData(db);
  });
};
