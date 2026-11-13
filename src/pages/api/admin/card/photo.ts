import type { APIRoute } from 'astro';
import { adminRoute } from '~/features/admin/admin.http';
import { loadEditorData, setCardImage } from '~/features/card/card.admin';
import { getDb } from '~/lib/db/client';
import { problem } from '~/lib/http';
import { IMAGE, ImageRejectedError, storePhoto } from '~/lib/storage/images';
import { getStorage } from '~/lib/storage/storage';

/** Envoi de la photo des mariés (multipart, champ « photo »). */
export const POST: APIRoute = async ({ request }) => {
  if (Number(request.headers.get('content-length') ?? 0) > IMAGE.MAX_BYTES + 100_000) {
    return problem(413, 'too_large');
  }
  let file: File | null;
  try {
    const f = (await request.formData()).get('photo');
    file = f instanceof File ? f : null;
  } catch {
    return problem(400, 'bad_form');
  }
  if (!file) return problem(400, 'no_file');
  let base: string;
  try {
    base = await storePhoto(getStorage(), Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    if (err instanceof ImageRejectedError) return problem(400, 'image');
    throw err;
  }
  return adminRoute('photo', async () => {
    const db = getDb();
    const { previous } = await setCardImage(db, 'photoKey', base);
    if (previous) await getStorage().deletePrefix(previous);
    return loadEditorData(db);
  });
};

export const DELETE: APIRoute = () =>
  adminRoute('photo-delete', async () => {
    const db = getDb();
    const { previous } = await setCardImage(db, 'photoKey', null);
    if (previous) await getStorage().deletePrefix(previous);
    return loadEditorData(db);
  });
