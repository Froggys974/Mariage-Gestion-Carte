/**
 * Confettis-pétales et fleur qui éclot au toucher (logique du prototype : burst() et spawnFlower()).
 * N'anime que transform et opacity.
 */
import { createFlower, PALETTE_LIST } from './flowers';

export const CONFETTI = {
  COLORS: ['#e9544f', '#d8468f', '#f2d7a3', '#fff6e6', '#f4b73f', '#2b8a7e'],
  MIN_W: 8,
  RAND_W: 12,
  RATIO_H: 1.3,
  DEFAULT_SPREAD: 140,
  SPREAD_MIN: 0.4,
  SPREAD_RAND: 0.8,
  LIFT: 60,
  FALL: 220,
  DRIFT: 1.25,
  MAX_ROT: 720,
  DUR_MIN: 1600,
  DUR_RAND: 900,
  EASING: 'cubic-bezier(.15,.7,.4,1)',
  FLOWER_DUR: 1500,
  FLOWER_EASING: 'cubic-bezier(.2,.7,.3,1)',
  FLOWER_SPIN: 120,
  /** facteur sur le nombre de pétales en mode économie */
  ECONOMY_FACTOR: 0.4,
} as const;

export interface ConfettiOptions {
  economy?: boolean;
  /** aucun effet (prefers-reduced-motion) */
  disabled?: boolean;
}

export interface ConfettiController {
  burst(x: number, y: number, n: number, spread?: number): void;
  flower(x: number, y: number, size: number): void;
  setEconomy(v: boolean): void;
  destroy(): void;
}

/** Trajectoire d'un pétale (pure, testée). */
export function petalPath(angle: number, distance: number) {
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance - CONFETTI.LIFT;
  return { dx, dy, endX: dx * CONFETTI.DRIFT, endY: dy + CONFETTI.FALL };
}

export function init(layer: HTMLElement, options: ConfettiOptions = {}): ConfettiController {
  let economy = options.economy ?? false;
  const live = new Set<Animation>();

  const track = (a: Animation, el: Element) => {
    live.add(a);
    a.onfinish = () => {
      live.delete(a);
      el.remove();
    };
  };

  return {
    burst(x, y, n, spread = CONFETTI.DEFAULT_SPREAD) {
      if (options.disabled) return;
      const count = Math.max(1, Math.round(economy ? n * CONFETTI.ECONOMY_FACTOR : n));
      for (let k = 0; k < count; k++) {
        const el = document.createElement('div');
        el.className = 'fx-petal';
        const w = CONFETTI.MIN_W + Math.random() * CONFETTI.RAND_W;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.width = `${w}px`;
        el.style.height = `${w * CONFETTI.RATIO_H}px`;
        el.style.background = CONFETTI.COLORS[k % CONFETTI.COLORS.length] ?? '#fff';
        layer.appendChild(el);
        const a = Math.random() * Math.PI * 2;
        const d = spread * (CONFETTI.SPREAD_MIN + Math.random() * CONFETTI.SPREAD_RAND);
        const { dx, dy, endX, endY } = petalPath(a, d);
        const rot = (Math.random() - 0.5) * CONFETTI.MAX_ROT;
        const anim = el.animate(
          [
            { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
            {
              transform: `translate(${dx}px,${dy}px) scale(1) rotate(${rot / 2}deg)`,
              opacity: 1,
              offset: 0.45,
            },
            { transform: `translate(${endX}px,${endY}px) scale(.8) rotate(${rot}deg)`, opacity: 0 },
          ],
          { duration: CONFETTI.DUR_MIN + Math.random() * CONFETTI.DUR_RAND, easing: CONFETTI.EASING },
        );
        track(anim, el);
      }
    },
    flower(x, y, size) {
      if (options.disabled) return;
      const kind = PALETTE_LIST[Math.floor(Math.random() * PALETTE_LIST.length)] ?? 'hibiscus';
      const wrap = document.createElement('div');
      wrap.className = 'fx-flower';
      wrap.style.left = `${x}px`;
      wrap.style.top = `${y}px`;
      wrap.style.width = `${size}px`;
      wrap.style.height = `${size}px`;
      const f = createFlower(kind);
      f.style.width = '100%';
      f.style.height = '100%';
      wrap.appendChild(f);
      layer.appendChild(wrap);
      const r = (Math.random() - 0.5) * CONFETTI.FLOWER_SPIN;
      const anim = wrap.animate(
        [
          { transform: 'translate(-50%,-50%) scale(0) rotate(-90deg)', opacity: 1 },
          { transform: 'translate(-50%,-50%) scale(1.15) rotate(10deg)', opacity: 1, offset: 0.35 },
          { transform: 'translate(-50%,-50%) scale(1) rotate(20deg)', opacity: 1, offset: 0.6 },
          { transform: `translate(-50%,-150%) scale(.7) rotate(${r}deg)`, opacity: 0 },
        ],
        { duration: CONFETTI.FLOWER_DUR, easing: CONFETTI.FLOWER_EASING },
      );
      track(anim, wrap);
    },
    setEconomy(v) {
      economy = v;
    },
    destroy() {
      for (const a of live) a.cancel();
      live.clear();
      layer.replaceChildren();
    },
  };
}
