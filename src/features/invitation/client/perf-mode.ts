/**
 * Niveau d'animation selon l'appareil :
 * - reduced  : prefers-reduced-motion → intro raccourcie, simples fondus, table fixe mais utilisable
 * - economy  : pas de preserve-3d, ou appareil faible (≤ 4 cœurs et pas ≥ 4 Go) → moins de particules,
 *              table 3D sans inertie, pas de flou animé
 * - full     : tout
 * Repli automatique en « economy » si on mesure moins de 40 images par seconde pendant un mouvement.
 */
export type MotionMode = 'full' | 'economy' | 'reduced';

export interface DeviceCaps {
  reducedMotion: boolean;
  preserve3d: boolean;
  cores?: number;
  memoryGb?: number;
}

export const PERF = {
  LOW_CORES: 4,
  ENOUGH_MEMORY_GB: 4,
  FPS_THRESHOLD: 40,
  /** durée de mouvement observée avant de juger */
  FPS_WINDOW_MS: 1500,
  /** les images de plus de 250 ms (onglet en pause) sont ignorées */
  FRAME_IGNORE_MS: 250,
} as const;

export function chooseMode(c: DeviceCaps): MotionMode {
  if (c.reducedMotion) return 'reduced';
  if (!c.preserve3d) return 'economy';
  const weak =
    c.cores !== undefined &&
    c.cores <= PERF.LOW_CORES &&
    !(c.memoryGb !== undefined && c.memoryGb >= PERF.ENOUGH_MEMORY_GB);
  return weak ? 'economy' : 'full';
}

export function readCaps(): DeviceCaps {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    preserve3d: typeof CSS !== 'undefined' && CSS.supports?.('transform-style', 'preserve-3d') === true,
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory,
  };
}

/** Moniteur de fluidité : n'observe que les images pendant un mouvement. */
export function createFpsMonitor(onLow: (fps: number) => void) {
  let elapsed = 0;
  let frames = 0;
  let fired = false;
  return {
    frame(dt: number, moving: boolean): void {
      if (fired || !moving || dt <= 0 || dt > PERF.FRAME_IGNORE_MS) return;
      elapsed += dt;
      frames += 1;
      if (elapsed >= PERF.FPS_WINDOW_MS) {
        const fps = (frames * 1000) / elapsed;
        if (fps < PERF.FPS_THRESHOLD) {
          fired = true;
          onLow(fps);
        }
        elapsed = 0;
        frames = 0;
      }
    },
    get triggered() {
      return fired;
    },
  };
}
