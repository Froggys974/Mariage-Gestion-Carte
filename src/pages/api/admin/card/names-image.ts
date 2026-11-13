import type { APIRoute } from 'astro';
import { adminRoute } from '~/features/admin/admin.http';
import { setCardImage } from '~/features/card/card.admin';
import { getDb } from '~/lib/db/client';
import { problem } from '~/lib/http';
import { ImageRejectedError, storeNamesImage } from '~/lib/storage/images';
import { getStorage } from '~/lib/storage/storage';

/** Image PNG des noms en Pinyon Script, dessinée par le navigateur de l'admin (pour les emails). */
export const POST: APIRoute = async ({ request }) => {
  if ((request.headers.get('content-type') ?? '') !== 'image/png') return problem(415, 'png_only');
  let key: string;
  try {
    key = await storeNamesImage(getStorage(), Buffer.from(await request.arrayBuffer()));
  } catch (err) {
    if (err instanceof ImageRejectedError) return problem(400, 'image');
    throw err;
  }
  return adminRoute('names-image', async () => {
    const { previous } = await setCardImage(getDb(), 'namesImageKey', key);
    if (previous) await getStorage().deletePrefix(previous.replace(/\.png$/, ''));
    return { key };
  });
};
