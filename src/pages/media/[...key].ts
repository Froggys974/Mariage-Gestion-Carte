import type { APIRoute } from 'astro';
import { getStorage, type StoredFile } from '~/lib/storage/storage';

/** Fichiers envoyés (photo de la carte, image des noms). Les clés changent à chaque envoi : cache long. */
export const GET: APIRoute = async ({ params }) => {
  let file: StoredFile | null;
  try {
    file = await getStorage().get(params.key ?? '');
  } catch {
    file = null;
  }
  if (!file) return new Response('not found', { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      'content-type': file.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
};
