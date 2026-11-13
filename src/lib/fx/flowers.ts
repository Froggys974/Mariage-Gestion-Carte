/** Fleurs CSS créées à la volée (fleur au toucher, confettis) — même géométrie que Flower.astro. */

export type FlowerKind = 'hibiscus' | 'bougain' | 'frangipani' | 'vanille';

export const PALETTE: Record<FlowerKind, readonly [string, string]> = {
  frangipani: ['#f4b73f', '#fff6e6'],
  hibiscus: ['#8e1630', '#e9544f'],
  bougain: ['#8a1f5c', '#d8468f'],
  vanille: ['#b9852d', '#f2d7a3'],
};

/** Ordre du prototype : PAL_LIST = [hibiscus, frangipani, bougain, vanille] */
export const PALETTE_LIST: readonly FlowerKind[] = ['hibiscus', 'frangipani', 'bougain', 'vanille'];

/** Fleur DOM (classes de flower.css, couleurs en variables CSS : compatible CSP). */
export function createFlower(kind: FlowerKind, heart = true): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = `flower flower--${kind}`;
  el.setAttribute('aria-hidden', 'true');
  for (let k = 0; k < 5; k++) el.appendChild(document.createElement('i'));
  if (heart) el.appendChild(document.createElement('b'));
  return el;
}

/** Générateur pseudo-aléatoire du prototype (positions identiques à chaque chargement). */
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
