import type { APIRoute } from 'astro';
import { z } from 'zod';
import { adminRoute } from '~/features/admin/admin.http';
import { createPlan, getPlan, listPlans } from '~/features/seating/seating.service';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

export const GET: APIRoute = () => adminRoute('plans', async () => ({ plans: await listPlans(getDb()) }));

const body = z.object({ name: z.string().trim().min(1).max(60), copyFrom: z.uuid().nullish() });

/** Nouvelle version du plan (vide, ou copie d'une version existante). */
export const POST: APIRoute = async ({ request }) => {
  const b = await readJson(request, body);
  if (!b.ok) return b.response;
  return adminRoute('plan-create', async () => {
    const db = getDb();
    const id = await createPlan(db, b.data.name, b.data.copyFrom ?? null);
    return { plan: await getPlan(db, id), plans: await listPlans(db) };
  });
};
