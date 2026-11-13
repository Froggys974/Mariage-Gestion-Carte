/**
 * Opérations sur les affectations du plan (prototype : onUp / editSel / delTable), sous forme pure.
 * Une affectation associe une chaise « tableId:index » à une personne (guestId). Une personne
 * n'occupe jamais deux chaises.
 */

export type Assign = Readonly<Record<string, string>>;

export const seatKey = (tableId: string, index: number): string => `${tableId}:${index}`;

export function parseSeatKey(key: string): { tableId: string; index: number } | null {
  const i = key.lastIndexOf(':');
  if (i <= 0) return null;
  const index = Number(key.slice(i + 1));
  return Number.isInteger(index) && index >= 0 ? { tableId: key.slice(0, i), index } : null;
}

/**
 * Dépose une personne :
 * - sur une chaise libre → elle s'y assoit (et quitte sa chaise précédente) ;
 * - sur une chaise occupée, en venant d'une autre chaise → les deux personnes échangent ;
 * - sur une chaise occupée, en venant de la liste → l'occupant retourne dans la liste ;
 * - dans la liste (target null) → elle est retirée du plan.
 */
export function dropPerson(
  assign: Assign,
  personId: string,
  fromSeat: string | null,
  target: string | null,
): Record<string, string> {
  const a: Record<string, string> = { ...assign };
  for (const k of Object.keys(a)) if (a[k] === personId) delete a[k];
  if (target) {
    const prev = a[target];
    if (prev && fromSeat && fromSeat !== target) a[fromSeat] = prev;
    a[target] = personId;
  }
  return a;
}

/** Retire les affectations des chaises qui n'existent plus (moins de chaises sur une table). */
export function trimTable(assign: Assign, tableId: string, seatCount: number): Record<string, string> {
  const a: Record<string, string> = {};
  for (const [k, v] of Object.entries(assign)) {
    const s = parseSeatKey(k);
    if (s && s.tableId === tableId && s.index >= seatCount) continue;
    a[k] = v;
  }
  return a;
}

/** Retire toutes les affectations d'une table supprimée. */
export function removeTable(assign: Assign, tableId: string): Record<string, string> {
  return Object.fromEntries(Object.entries(assign).filter(([k]) => parseSeatKey(k)?.tableId !== tableId));
}

/** Personne → chaise (inverse de l'affectation). */
export function placedOf(assign: Assign): Map<string, string> {
  return new Map(Object.entries(assign).map(([k, v]) => [v, k]));
}

/** Initiales et nom court affichés sur les chaises (prototype). */
export function seatInitials(first: string, last: string): string {
  // sans nom : 2e partie du prénom composé (Jean Luc → JL, Marie-Ange → MA)
  const second = last || first.split(/[\s-]+/)[1] || ' ';
  return ((first[0] ?? '') + (second[0] ?? '')).trim().toUpperCase();
}

export function shortName(first: string, last: string): string {
  return first + (last ? ` ${last[0]}.` : '');
}

/** Défilement automatique pendant un glisser : px par image, négatif près du haut, positif près du bas. */
export const EDGE_SCROLL = { ZONE_PX: 72, MAX_PX: 18 } as const;
export function edgeScrollSpeed(y: number, height: number): number {
  const { ZONE_PX, MAX_PX } = EDGE_SCROLL;
  const yy = Math.min(Math.max(y, 0), height);
  if (yy < ZONE_PX) return -Math.ceil(((ZONE_PX - yy) / ZONE_PX) * MAX_PX);
  if (yy > height - ZONE_PX) return Math.ceil(((yy - (height - ZONE_PX)) / ZONE_PX) * MAX_PX);
  return 0;
}
