import type { APIRoute } from 'astro';
import { adminRoute } from '~/features/admin/admin.http';
import {
  AlreadyConfiguredError,
  setupInput,
  setupWedding,
  updateWedding,
  weddingInput,
} from '~/features/wedding/wedding.service';
import { getDb } from '~/lib/db/client';
import { problem, readJson } from '~/lib/http';

/** Assistant d'installation : crée le mariage (une seule fois). */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request, setupInput);
  if (!body.ok) return body.response;
  return adminRoute('wedding-setup', async () => {
    try {
      return { wedding: await setupWedding(getDb(), body.data) };
    } catch (err) {
      if (err instanceof AlreadyConfiguredError) return problem(409, 'already_configured');
      throw err;
    }
  });
};

/** Onglet « Mariage » : met à jour les informations. */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readJson(request, weddingInput);
  if (!body.ok) return body.response;
  return adminRoute('wedding-update', async () => ({ wedding: await updateWedding(getDb(), body.data) }));
};
