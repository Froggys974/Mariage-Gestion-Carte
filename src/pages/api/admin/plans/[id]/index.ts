import type { APIRoute } from 'astro';
import { z } from 'zod';
import { adminRoute } from '~/features/admin/admin.http';
import {
  deletePlan,
  getPlan,
  listPlans,
  PlanConflictError,
  PlanInvalidError,
  planSaveBody,
  renamePlan,
  savePlan,
  setActivePlan,
} from '~/features/seating/seating.service';
import { getDb } from '~/lib/db/client';
import { problem, readJson } from '~/lib/http';

const id = z.uuid();

export const GET: APIRoute = ({ params }) => {
  if (!id.safeParse(params.id).success) return problem(404, 'not_found');
  return adminRoute('plan', async () => (await getPlan(getDb(), params.id!)) ?? problem(404, 'not_found'));
};

/** Enregistre le plan complet (tables + chaises). */
export const PUT: APIRoute = async ({ params, request }) => {
  if (!id.safeParse(params.id).success) return problem(404, 'not_found');
  const b = await readJson(request, planSaveBody, 200_000);
  if (!b.ok) return b.response;
  try {
    return await adminRoute('plan-save', async () => {
      try {
        return await savePlan(getDb(), params.id!, b.data);
      } catch (err) {
        if (err instanceof PlanConflictError) return problem(409, 'conflict');
        if (err instanceof PlanInvalidError) return problem(400, err.message);
        throw err;
      }
    });
  } catch {
    return problem(500, 'server_error');
  }
};

const patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  active: z.literal(true).optional(),
});

/** Renommer, ou définir comme plan actif. */
export const PATCH: APIRoute = async ({ params, request }) => {
  if (!id.safeParse(params.id).success) return problem(404, 'not_found');
  const b = await readJson(request, patch);
  if (!b.ok) return b.response;
  return adminRoute('plan-patch', async () => {
    const db = getDb();
    if (b.data.name) await renamePlan(db, params.id!, b.data.name);
    if (b.data.active) await setActivePlan(db, params.id!);
    return { plans: await listPlans(db) };
  });
};

export const DELETE: APIRoute = ({ params }) => {
  if (!id.safeParse(params.id).success) return problem(404, 'not_found');
  return adminRoute('plan-delete', async () => {
    const db = getDb();
    await deletePlan(db, params.id!);
    return { plans: await listPlans(db) };
  });
};
