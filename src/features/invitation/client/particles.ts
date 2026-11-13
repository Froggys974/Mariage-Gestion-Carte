/**
 * Décor animé du fond (prototype) : 6 fleurs flottantes à faible opacité et 42 particules
 * (pétales et points lumineux) qui défilent en Z pendant la navigation (voir scene-nav.ts › moteStyle).
 * Positions issues du générateur pseudo-aléatoire du prototype (graine 7) : identiques à chaque visite.
 */
import { createFlower, PALETTE_LIST, seededRandom } from '~/lib/fx/flowers';

export const PARTICLES = {
  SEED: 7,
  MOTES: 42,
  MOTES_ECONOMY: 14,
  FLOATERS: 6,
  FLOATERS_ECONOMY: 3,
  MOTE_COLORS: [
    'rgba(255,236,190,.95)',
    'rgba(233,84,79,.85)',
    'rgba(216,70,143,.8)',
    'rgba(246,194,90,.9)',
    'rgba(255,246,230,.9)',
  ],
  FLOAT_BASE_MS: 9000,
  FLOAT_STEP_MS: 1800,
} as const;

export interface Mote {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: string;
  color: string;
  glow: number;
  z: number;
}

export interface Floater {
  x: number;
  y: number;
  size: number;
  opacity: number;
  kind: (typeof PALETTE_LIST)[number];
}

/** Même ordre de tirages que le constructeur du prototype : particules, puis fleurs flottantes. */
export function buildDecor(): { motes: Mote[]; floaters: Floater[] } {
  const r = seededRandom(PARTICLES.SEED);
  const motes: Mote[] = [];
  for (let k = 0; k < PARTICLES.MOTES; k++) {
    const petal = k % 3 === 0;
    const sz = petal ? 7 + r() * 9 : 2 + r() * 4;
    const a = r() * Math.PI * 2;
    const d = 12 + r() * 48;
    const x = +(50 + Math.cos(a) * d).toFixed(1);
    const y = +(46 + Math.sin(a) * d * 1.1).toFixed(1);
    const glow = petal ? 0 : Math.round(6 + r() * 8);
    const z = Math.round(r() * 1800);
    motes.push({
      x,
      y,
      w: +sz.toFixed(1),
      h: +(petal ? sz * 1.35 : sz).toFixed(1),
      radius: petal ? '60% 40% 60% 40% / 70% 70% 30% 30%' : '50%',
      color: PARTICLES.MOTE_COLORS[k % PARTICLES.MOTE_COLORS.length] ?? '#fff',
      glow,
      z,
    });
  }
  const floaters: Floater[] = [];
  for (let i = 0; i < PARTICLES.FLOATERS; i++) {
    floaters.push({
      x: +(r() * 90).toFixed(1),
      y: +(r() * 90).toFixed(1),
      size: Math.round(26 + r() * 30),
      opacity: 0.16 + r() * 0.12,
      kind: PALETTE_LIST[i % 4] ?? 'hibiscus',
    });
  }
  return { motes, floaters };
}

export interface ParticlesOptions {
  economy: boolean;
  reduced: boolean;
}

export function init(
  floaterLayer: HTMLElement,
  moteLayer: HTMLElement,
  options: ParticlesOptions,
): { destroy(): void } {
  const { motes, floaters } = buildDecor();
  const anims: Animation[] = [];

  const nFloat = options.economy ? PARTICLES.FLOATERS_ECONOMY : PARTICLES.FLOATERS;
  floaters.slice(0, nFloat).forEach((f, i) => {
    const el = createFlower(f.kind, false);
    el.classList.add('g-floater');
    el.style.left = `${f.x}%`;
    el.style.top = `${f.y}%`;
    el.style.width = `${f.size}px`;
    el.style.height = `${f.size}px`;
    el.style.opacity = String(f.opacity);
    floaterLayer.appendChild(el);
    if (!options.reduced) {
      const dx = (i % 2 ? 1 : -1) * (20 + i * 6);
      const dy = 30 + i * 8;
      anims.push(
        el.animate(
          [
            { transform: 'translate(0,0) rotate(0deg)' },
            { transform: `translate(${dx}px,${dy}px) rotate(${120 + i * 30}deg)` },
          ],
          {
            duration: PARTICLES.FLOAT_BASE_MS + i * PARTICLES.FLOAT_STEP_MS,
            iterations: Infinity,
            direction: 'alternate',
            easing: 'ease-in-out',
          },
        ),
      );
    }
  });

  if (!options.reduced) {
    const nMotes = options.economy ? PARTICLES.MOTES_ECONOMY : PARTICLES.MOTES;
    for (const m of motes.slice(0, nMotes)) {
      const el = document.createElement('div');
      el.className = 'g-mote';
      el.dataset.mote = '1';
      el.dataset.z = String(m.z);
      el.style.left = `${m.x}%`;
      el.style.top = `${m.y}%`;
      el.style.width = `${m.w}px`;
      el.style.height = `${m.h}px`;
      el.style.margin = `-${(m.w / 2).toFixed(1)}px 0 0 -${(m.w / 2).toFixed(1)}px`;
      el.style.borderRadius = m.radius;
      el.style.background = m.color;
      if (m.glow) el.style.boxShadow = `0 0 ${m.glow}px ${m.color}`;
      moteLayer.appendChild(el);
    }
  }

  return {
    destroy() {
      anims.forEach((a) => a.cancel());
      floaterLayer.replaceChildren();
      moteLayer.replaceChildren();
    },
  };
}
