/**
 * Programme de la journée : limites communes au serveur, à l'onglet « Programme » de l'admin
 * et au site invité. Aucun import Node ici (utilisé par un îlot).
 */
import type { ProgrammeItem } from '~/lib/db/schema';

export type { ProgrammeItem };

export const PROGRAMME = {
  MAX_ITEMS: 12,
  TIME_MAX: 20,
  TITLE_MAX: 60,
  PLACE_MAX: 120,
  NOTE_MAX: 200,
} as const;

export const emptyItem = (): ProgrammeItem => ({ time: '', title: '', place: '', note: '' });

/** Déplace l'élément `from` d'un cran (-1 vers le haut, +1 vers le bas) ; sans effet aux extrémités. */
export function moveItem<T>(list: readonly T[], from: number, dir: -1 | 1): T[] {
  const to = from + dir;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
