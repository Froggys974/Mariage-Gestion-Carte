/**
 * Remplacement d'une réponse — JAMAIS un ajout à la suite.
 *
 * La nouvelle liste remplace entièrement l'ancienne : à la fin, il y a exactement une ligne `guest`
 * par chaise occupée. Les personnes déjà connues (même id) sont mises à jour plutôt que recréées,
 * pour qu'une personne déjà placée garde sa chaise dans le plan de table (voir doc/adr/0003).
 */

export interface ExistingGuest {
  id: string;
  position: number;
}

export interface IncomingSeat {
  id?: string;
  first: string;
  last: string;
  note: string;
}

export interface GuestRow {
  position: number;
  firstName: string;
  lastName: string;
  notes: string | null;
  isPrimary: boolean;
}

export interface ReplacementPlan {
  deletes: string[];
  updates: Array<GuestRow & { id: string }>;
  inserts: GuestRow[];
}

function toRow(s: IncomingSeat, position: number): GuestRow {
  const note = s.note.trim();
  return {
    position,
    firstName: s.first.trim(),
    lastName: s.last.trim(),
    notes: note === '' ? null : note,
    isPrimary: position === 0,
  };
}

export function planGuestReplacement(
  existing: readonly ExistingGuest[],
  incoming: ReadonlyArray<IncomingSeat | null>,
): ReplacementPlan {
  const known = new Set(existing.map((g) => g.id));
  const used = new Set<string>();
  const updates: ReplacementPlan['updates'] = [];
  const inserts: GuestRow[] = [];
  incoming.forEach((seat, position) => {
    if (!seat) return;
    // un id inconnu, ou déjà utilisé par une autre chaise, devient une nouvelle personne
    if (seat.id && known.has(seat.id) && !used.has(seat.id)) {
      used.add(seat.id);
      updates.push({ id: seat.id, ...toRow(seat, position) });
    } else {
      inserts.push(toRow(seat, position));
    }
  });
  const deletes = existing.filter((g) => !used.has(g.id)).map((g) => g.id);
  return { deletes, updates, inserts };
}

/** Résultat final après application du plan (utile aux tests et aux vérifications). */
export function applyPlan(
  existing: ReadonlyArray<ExistingGuest & Partial<GuestRow>>,
  plan: ReplacementPlan,
): Array<GuestRow & { id: string }> {
  const del = new Set(plan.deletes);
  const upd = new Map(plan.updates.map((u) => [u.id, u]));
  const kept = existing.filter((g) => !del.has(g.id)).map((g) => upd.get(g.id)!);
  const added = plan.inserts.map((r, k) => ({ id: `new-${k}`, ...r }));
  return [...kept, ...added].sort((a, b) => a.position - b.position);
}
