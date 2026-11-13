/** Géométrie du plan de table (prototype « Tableau de bord » : geom()). */

export const ROOM = {
  W: 1100,
  H: 760,
  /** limites de déplacement du centre d'une table */
  MIN_X: 60,
  MAX_X: 1040,
  MIN_Y: 90,
  MAX_Y: 710,
  DANCE: { x: 400, y: 40, w: 300, h: 70 },
  GRID: 24,
} as const;

export const TABLE_GEOM = {
  MIN_SEATS: 2,
  MAX_SEATS: 16,
  DEFAULT_ROUND: 8,
  DEFAULT_RECT: 10,
  /** ronde : rayon max(42, n·7,5), chaises sur un cercle de rayon + 26 */
  ROUND_MIN_R: 42,
  ROUND_R_PER_SEAT: 7.5,
  ROUND_RING_GAP: 26,
  /** rectangulaire : largeur max(110, n_haut·46), hauteur 66, chaises à 25 px au-dessus / dessous */
  RECT_MIN_W: 110,
  RECT_W_PER_SEAT: 46,
  RECT_H: 66,
  RECT_SEAT_GAP: 25,
  SEAT_SIZE: 34,
  HOT_SCALE: 1.22,
} as const;

export type Shape = 'round' | 'rect';

export interface TableLike {
  shape: Shape;
  n: number;
}

export interface Geometry {
  w: number;
  h: number;
  radius: string;
  /** positions des chaises relatives au centre de la table */
  seats: Array<[number, number]>;
}

export function tableGeometry(t: TableLike): Geometry {
  const seats: Array<[number, number]> = [];
  if (t.shape === 'round') {
    const R = Math.max(TABLE_GEOM.ROUND_MIN_R, t.n * TABLE_GEOM.ROUND_R_PER_SEAT);
    const ring = R + TABLE_GEOM.ROUND_RING_GAP;
    for (let k = 0; k < t.n; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / t.n;
      seats.push([Math.cos(a) * ring, Math.sin(a) * ring]);
    }
    return { w: 2 * R, h: 2 * R, radius: '50%', seats };
  }
  const top = Math.ceil(t.n / 2);
  const bot = t.n - top;
  const w = Math.max(TABLE_GEOM.RECT_MIN_W, top * TABLE_GEOM.RECT_W_PER_SEAT);
  const h = TABLE_GEOM.RECT_H;
  for (let k = 0; k < top; k++)
    seats.push([-w / 2 + ((k + 0.5) * w) / top, -h / 2 - TABLE_GEOM.RECT_SEAT_GAP]);
  for (let k = 0; k < bot; k++)
    seats.push([-w / 2 + ((k + 0.5) * w) / bot, h / 2 + TABLE_GEOM.RECT_SEAT_GAP]);
  return { w, h, radius: '10px', seats };
}

export function clampTablePosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(ROOM.MIN_X, Math.min(ROOM.MAX_X, Math.round(x))),
    y: Math.max(ROOM.MIN_Y, Math.min(ROOM.MAX_Y, Math.round(y))),
  };
}

export function clampSeats(n: number): number {
  return Math.max(TABLE_GEOM.MIN_SEATS, Math.min(TABLE_GEOM.MAX_SEATS, Math.round(n)));
}

/** Position d'une nouvelle table (prototype : addTable). */
export function newTablePosition(count: number): { x: number; y: number } {
  return { x: 250 + (count % 4) * 190, y: 300 + Math.floor(count / 4) * 60 };
}
