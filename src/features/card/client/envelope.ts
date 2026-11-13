/**
 * Ouverture du faire\u2011part (prototype : openCard / replayCard), en 2 s :
 * 1. le sceau grossit, tourne et disparaît (650 ms) · 2. confettis · 3. les rabats s'ouvrent en 3D,
 * l'un après l'autre (170 ms d'écart) · 4. la carte s'éclaire · 5. reflet doré · 6. lignes à 110 ms d'écart.
 */
import type { ConfettiController } from '~/lib/fx/confetti';
import type { MotionMode } from '../../invitation/client/perf-mode';

export const ENVELOPE = {
  SEAL_MS: 650,
  SEAL_EASING: 'cubic-bezier(.5,0,.5,1)',
  BURST1_AT_MS: 320,
  BURST1_COUNT: 26,
  BURST1_SPREAD: 160,
  FLAP_DELAY_MS: 420,
  FLAP_STAGGER_MS: 170,
  FLAP_MS: 1050,
  FLAP_EASING: 'cubic-bezier(.45,.05,.3,1)',
  FACE_DELAY_MS: 900,
  FACE_MS: 1200,
  SHINE_DELAY_MS: 1500,
  SHINE_MS: 1300,
  LINES_DELAY_MS: 1150,
  LINE_STAGGER_MS: 110,
  LINE_MS: 700,
  RISE_EASING: 'cubic-bezier(.2,.7,.2,1)',
  BURST2_AT_MS: 1500,
  BURST2_COUNT: 34,
  BURST2_SPREAD: 220,
  BURST2_TOP_OFFSET: 20,
  FLOWERS_AT_MS: 1700,
  FLOWER_A: { dx: 6, dy: 10, size: 46 },
  FLOWER_B: { dx: -6, dy: -20, size: 52 },
  DONE_MS: 2000,
  REPLAY_DELAY_MS: 350,
  REDUCED_MS: 400,
} as const;

/** Rabats dans l'ordre d'ouverture : [nom, départ, mi-course, fin] (prototype). */
export const FLAPS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['t', 'rotateX(0deg)', 'rotateX(-110deg)', 'rotateX(-180deg) translateY(-30%) scale(.9)'],
  ['b', 'rotateX(0deg)', 'rotateX(110deg)', 'rotateX(180deg) translateY(30%) scale(.9)'],
  ['r', 'rotateY(0deg)', 'rotateY(110deg)', 'rotateY(180deg) translateX(-30%) scale(.9)'],
  ['l', 'rotateY(0deg)', 'rotateY(-110deg)', 'rotateY(-180deg) translateX(30%) scale(.9)'],
];

/** Moment de départ de chaque étape (ms) : utile aux tests et à la documentation. */
export function timeline(lines: number) {
  return {
    flaps: FLAPS.map((_, k) => ENVELOPE.FLAP_DELAY_MS + k * ENVELOPE.FLAP_STAGGER_MS),
    lines: Array.from({ length: lines }, (_, k) => ENVELOPE.LINES_DELAY_MS + k * ENVELOPE.LINE_STAGGER_MS),
    done: ENVELOPE.DONE_MS,
  };
}

export interface EnvelopeOptions {
  fx: ConfettiController | null;
  mode: () => MotionMode;
  onOpened: () => void;
  onReset: () => void;
}

export interface EnvelopeController {
  open(): void;
  replay(): void;
  readonly isOpen: boolean;
  destroy(): void;
}

export function init(env: HTMLElement, options: EnvelopeOptions): EnvelopeController {
  const q = <T extends Element = HTMLElement>(s: string) => env.querySelector<T & HTMLElement>(s);
  const seal = q('[data-seal]');
  const face = q('[data-cardface]');
  const shine = q('[data-shine]');
  const lines = Array.from(env.querySelectorAll<HTMLElement>('[data-crise]'));
  let anims: Animation[] = [];
  let timers: number[] = [];
  let opening = false;
  let open = false;

  const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

  const run = () => {
    if (open || opening) return;
    opening = true;
    const mode = options.mode();
    const rect = env.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    if (mode === 'reduced') {
      // Simple fondu : rabats et sceau disparaissent, la carte reste en place.
      const fade = { duration: ENVELOPE.REDUCED_MS, fill: 'forwards' as const };
      if (seal) anims.push(seal.animate([{ opacity: 1 }, { opacity: 0 }], fade));
      env.querySelectorAll<HTMLElement>('[data-flap]').forEach((f) => {
        anims.push(f.animate([{ opacity: 1 }, { opacity: 0 }], fade));
      });
      later(ENVELOPE.REDUCED_MS, finish);
      return;
    }
    const light = mode === 'full';
    if (seal) {
      anims.push(
        seal.animate(
          [
            { transform: 'scale(1) rotate(0deg)', opacity: 1 },
            { transform: 'scale(1.35) rotate(40deg)', opacity: 1, offset: 0.4 },
            { transform: 'scale(0) rotate(220deg)', opacity: 0 },
          ],
          { duration: ENVELOPE.SEAL_MS, easing: ENVELOPE.SEAL_EASING, fill: 'forwards' },
        ),
      );
    }
    later(ENVELOPE.BURST1_AT_MS, () =>
      options.fx?.burst(cx, cy, ENVELOPE.BURST1_COUNT, ENVELOPE.BURST1_SPREAD),
    );
    FLAPS.forEach(([name, from, mid, to], k) => {
      const flap = q(`[data-flap="${name}"]`);
      if (!flap) return;
      anims.push(
        flap.animate(
          [
            { transform: from, opacity: 1, ...(light ? { filter: 'brightness(1)' } : {}) },
            { transform: mid, opacity: 1, ...(light ? { filter: 'brightness(1.25)' } : {}), offset: 0.5 },
            { transform: to, opacity: 0, ...(light ? { filter: 'brightness(.8)' } : {}) },
          ],
          {
            duration: ENVELOPE.FLAP_MS,
            delay: ENVELOPE.FLAP_DELAY_MS + k * ENVELOPE.FLAP_STAGGER_MS,
            easing: ENVELOPE.FLAP_EASING,
            fill: 'forwards',
          },
        ),
      );
    });
    if (face) {
      anims.push(
        face.animate(
          [
            { transform: 'scale(.94)', ...(light ? { filter: 'brightness(.7)' } : {}) },
            { transform: 'scale(1.04)', ...(light ? { filter: 'brightness(1.08)' } : {}), offset: 0.7 },
            { transform: 'scale(1)', ...(light ? { filter: 'brightness(1)' } : {}) },
          ],
          {
            duration: ENVELOPE.FACE_MS,
            delay: ENVELOPE.FACE_DELAY_MS,
            easing: ENVELOPE.RISE_EASING,
            fill: 'both',
          },
        ),
      );
    }
    if (shine) {
      anims.push(
        shine.animate(
          [{ transform: 'translateX(-100%) skewX(-12deg)' }, { transform: 'translateX(520%) skewX(-12deg)' }],
          {
            duration: ENVELOPE.SHINE_MS,
            delay: ENVELOPE.SHINE_DELAY_MS,
            easing: 'ease-in-out',
            fill: 'both',
          },
        ),
      );
    }
    lines.forEach((n, k) => {
      anims.push(
        n.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'none' },
          ],
          {
            duration: ENVELOPE.LINE_MS,
            delay: ENVELOPE.LINES_DELAY_MS + k * ENVELOPE.LINE_STAGGER_MS,
            easing: ENVELOPE.RISE_EASING,
            fill: 'both',
          },
        ),
      );
    });
    later(ENVELOPE.BURST2_AT_MS, () =>
      options.fx?.burst(
        cx,
        rect.top + ENVELOPE.BURST2_TOP_OFFSET,
        ENVELOPE.BURST2_COUNT,
        ENVELOPE.BURST2_SPREAD,
      ),
    );
    later(ENVELOPE.FLOWERS_AT_MS, () => {
      const a = ENVELOPE.FLOWER_A;
      const b = ENVELOPE.FLOWER_B;
      options.fx?.flower(rect.left + a.dx, rect.top + a.dy, a.size);
      options.fx?.flower(rect.right + b.dx, rect.bottom + b.dy, b.size);
    });
    later(ENVELOPE.DONE_MS, finish);
  };

  function finish() {
    opening = false;
    open = true;
    seal?.setAttribute('tabindex', '-1');
    seal?.setAttribute('aria-hidden', 'true');
    options.onOpened();
  }

  const onSeal = () => run();
  seal?.addEventListener('click', onSeal);

  return {
    open: run,
    replay() {
      timers.forEach(clearTimeout);
      timers = [];
      anims.forEach((a) => a.cancel());
      anims = [];
      open = false;
      opening = false;
      seal?.removeAttribute('tabindex');
      seal?.removeAttribute('aria-hidden');
      options.onReset();
      later(ENVELOPE.REPLAY_DELAY_MS, run);
    },
    get isOpen() {
      return open;
    },
    destroy() {
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      seal?.removeEventListener('click', onSeal);
    },
  };
}
