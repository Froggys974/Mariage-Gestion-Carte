/**
 * Plans de table : plusieurs versions, un plan actif, enregistrement complet (tables + chaises)
 * dans une transaction avec contrôle de version. Alerte si une personne placée n'est plus confirmée
 * ou a été retirée de la réponse.
 */
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { admin as t, status as statusLabels } from '~/content/fr';
import type { Db, DbOrTx } from '~/lib/db/client';
import { guest, invitation, seatingPlan, seatingSeat, seatingTable, type SeatingPlan } from '~/lib/db/schema';
import { formatTime } from '~/lib/dates';
import { TABLE_GEOM } from './plan-geometry';

export interface PlanPerson {
  id: string;
  first: string;
  last: string;
  note: string;
}
export interface PlanFamily {
  key: string;
  name: string;
  people: PlanPerson[];
}
export interface PlanTable {
  id: string;
  name: string;
  shape: 'round' | 'rect';
  n: number;
  x: number;
  y: number;
}
export interface PlanWarning {
  seat: string;
  message: string;
}
export interface PlanData {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
  savedLabel: string;
  tables: PlanTable[];
  assign: Record<string, string>;
  warnings: PlanWarning[];
}
export interface PlanSummary {
  id: string;
  name: string;
  isActive: boolean;
}

export const planSaveBody = z.object({
  expectedUpdatedAt: z.iso.datetime(),
  tables: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().trim().min(1).max(60),
        shape: z.enum(['round', 'rect']),
        n: z.number().int().min(TABLE_GEOM.MIN_SEATS).max(TABLE_GEOM.MAX_SEATS),
        x: z.number().int().min(0).max(1100),
        y: z.number().int().min(0).max(760),
      }),
    )
    .max(80),
  assign: z.record(z.string().regex(/^[0-9a-f-]{36}:\d{1,2}$/), z.uuid()),
});
export type PlanSaveInput = z.infer<typeof planSaveBody>;

export class PlanConflictError extends Error {}
export class PlanInvalidError extends Error {}

/** Personnes à placer : les mariés, puis chaque famille confirmée. */
export async function planPeople(db: DbOrTx): Promise<PlanFamily[]> {
  const rows = await db
    .select({ g: guest, inv: invitation })
    .from(guest)
    .innerJoin(invitation, eq(invitation.id, guest.invitationId))
    .where(eq(invitation.status, 'submitted'))
    .orderBy(desc(invitation.kind), asc(invitation.displayName), asc(guest.position));
  const fams = new Map<string, PlanFamily>();
  for (const { g, inv } of rows) {
    const f = fams.get(inv.id) ?? {
      key: inv.id,
      name: inv.kind === 'couple' ? t.plan.couple : inv.displayName,
      people: [],
    };
    f.people.push({ id: g.id, first: g.firstName, last: g.lastName, note: g.notes ?? '' });
    fams.set(inv.id, f);
  }
  return [...fams.values()];
}

export async function listPlans(db: DbOrTx): Promise<PlanSummary[]> {
  return db
    .select({ id: seatingPlan.id, name: seatingPlan.name, isActive: seatingPlan.isActive })
    .from(seatingPlan)
    .orderBy(desc(seatingPlan.isActive), asc(seatingPlan.createdAt));
}

export async function getPlan(db: DbOrTx, id: string): Promise<PlanData | null> {
  const [plan] = await db.select().from(seatingPlan).where(eq(seatingPlan.id, id));
  if (!plan) return null;
  const tables = await db
    .select()
    .from(seatingTable)
    .where(eq(seatingTable.planId, id))
    .orderBy(asc(seatingTable.sortOrder));
  const seats = await db
    .select({ s: seatingSeat, g: guest, inv: invitation })
    .from(seatingSeat)
    .leftJoin(guest, eq(guest.id, seatingSeat.guestId))
    .leftJoin(invitation, eq(invitation.id, guest.invitationId))
    .where(eq(seatingSeat.planId, id));
  const assign: Record<string, string> = {};
  const warnings: PlanWarning[] = [];
  for (const { s, g, inv } of seats) {
    const key = `${s.tableId}:${s.seatIndex}`;
    if (!g) {
      warnings.push({ seat: key, message: t.plan.warnRemoved(s.guestNameSnapshot) });
      continue;
    }
    assign[key] = g.id;
    if (inv && inv.status !== 'submitted') {
      warnings.push({
        seat: key,
        message: t.plan.warnNotConfirmed(`${g.firstName} ${g.lastName}`.trim(), statusLabels[inv.status]),
      });
    }
  }
  return {
    id: plan.id,
    name: plan.name,
    isActive: plan.isActive,
    updatedAt: plan.updatedAt.toISOString(),
    savedLabel: t.plan.savedAt(formatTime(plan.updatedAt)),
    tables: tables.map((x) => ({ id: x.id, name: x.name, shape: x.shape, n: x.seatCount, x: x.x, y: x.y })),
    assign,
    warnings,
  };
}

/** Plan à ouvrir : le plan demandé, sinon l'actif, sinon le premier (créé s'il n'y en a aucun). */
export async function resolvePlan(db: Db, wanted?: string | null): Promise<PlanData> {
  if (wanted) {
    const p = await getPlan(db, wanted).catch(() => null);
    if (p) return p;
  }
  const plans = await listPlans(db);
  const id = plans[0]?.id ?? (await createPlan(db, t.plan.versionDefault(1), null, true));
  return (await getPlan(db, id))!;
}

export async function createPlan(
  db: Db,
  name: string,
  copyFrom: string | null,
  active = false,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [plan] = await tx.insert(seatingPlan).values({ name, isActive: active }).returning();
    if (copyFrom) {
      const src = await getPlan(tx, copyFrom);
      if (src) {
        const idMap = new Map<string, string>();
        for (const [k, x] of src.tables.entries()) {
          const id = randomUUID();
          idMap.set(x.id, id);
          await tx.insert(seatingTable).values({
            id,
            planId: plan!.id,
            name: x.name,
            shape: x.shape,
            x: x.x,
            y: x.y,
            seatCount: x.n,
            sortOrder: k,
          });
        }
        await insertSeats(tx, plan!.id, src.assign, idMap);
      }
    }
    return plan!.id;
  });
}

async function insertSeats(
  tx: DbOrTx,
  planId: string,
  assign: Record<string, string>,
  idMap?: Map<string, string>,
): Promise<void> {
  const entries = Object.entries(assign);
  if (!entries.length) return;
  const ids = [...new Set(entries.map(([, g]) => g))];
  const names = await tx
    .select({ id: guest.id, first: guest.firstName, last: guest.lastName })
    .from(guest)
    .where(inArray(guest.id, ids));
  const nameOf = new Map(names.map((n) => [n.id, `${n.first} ${n.last}`.trim()]));
  const rows = entries.map(([key, guestId]) => {
    const i = key.lastIndexOf(':');
    const tableId = key.slice(0, i);
    return {
      planId,
      tableId: idMap?.get(tableId) ?? tableId,
      seatIndex: Number(key.slice(i + 1)),
      guestId,
      guestNameSnapshot: nameOf.get(guestId) ?? '',
    };
  });
  if (rows.some((r) => !nameOf.has(r.guestId))) throw new PlanInvalidError('guest');
  await tx.insert(seatingSeat).values(rows);
}

export async function savePlan(db: Db, id: string, input: PlanSaveInput): Promise<PlanData> {
  await db.transaction(async (tx) => {
    const [plan] = await tx.select().from(seatingPlan).where(eq(seatingPlan.id, id)).for('update');
    if (!plan) throw new PlanInvalidError('not_found');
    if (plan.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
      throw new PlanConflictError();
    const seatsOf = new Map(input.tables.map((x) => [x.id, x.n]));
    const seen = new Set<string>();
    for (const [key, guestId] of Object.entries(input.assign)) {
      const i = key.lastIndexOf(':');
      const n = seatsOf.get(key.slice(0, i));
      if (n === undefined || Number(key.slice(i + 1)) >= n) throw new PlanInvalidError('seat');
      if (seen.has(guestId)) throw new PlanInvalidError('duplicate');
      seen.add(guestId);
    }
    // Les tables appartiennent à ce plan : on remplace tout (les chaises suivent en cascade).
    await tx.delete(seatingTable).where(eq(seatingTable.planId, id));
    if (input.tables.length) {
      await tx.insert(seatingTable).values(
        input.tables.map((x, k) => ({
          id: x.id,
          planId: id,
          name: x.name,
          shape: x.shape,
          x: x.x,
          y: x.y,
          seatCount: x.n,
          sortOrder: k,
        })),
      );
    }
    await insertSeats(tx, id, input.assign);
    await tx.update(seatingPlan).set({ updatedAt: new Date() }).where(eq(seatingPlan.id, id));
  });
  return (await getPlan(db, id))!;
}

export async function renamePlan(db: DbOrTx, id: string, name: string): Promise<void> {
  await db.update(seatingPlan).set({ name }).where(eq(seatingPlan.id, id));
}

/** Un seul plan actif (garanti aussi par un index unique partiel). */
export async function setActivePlan(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(seatingPlan)
      .set({ isActive: false })
      .where(and(eq(seatingPlan.isActive, true), ne(seatingPlan.id, id)));
    await tx.update(seatingPlan).set({ isActive: true }).where(eq(seatingPlan.id, id));
  });
}

export async function deletePlan(db: DbOrTx, id: string): Promise<SeatingPlan | undefined> {
  const [row] = await db.delete(seatingPlan).where(eq(seatingPlan.id, id)).returning();
  return row;
}
