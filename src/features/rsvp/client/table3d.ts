/**
 * Table 3D en CSS (prototype : tickTable / tapSeat / tDown / tMove / tUp).
 * Plateau incliné (rotateX 58°), 6 chaises tous les 60° ; glisser de côté fait tourner la table
 * avec de l'inertie ; au repos elle tourne doucement ; toucher une chaise l'amène devant puis la recule.
 * Les noms au-dessus des chaises sont replacés à chaque image selon la position de la chaise à l'écran.
 */
import type { MotionMode } from '../../invitation/client/perf-mode';

export const TABLE = {
  SEATS: 6,
  SEAT_ANGLE: 60,
  /** rang de la scène Table (lu dans le HTML : data-scene) ; valeur de secours */
  TABLE_SCENE: 3,
  START_SPIN: -20,
  TILT: 58,
  /** inclinaison et rotation en plus pendant le passage d'une scène à l'autre */
  TILT_TRAVEL: 22,
  SPIN_TRAVEL: 80,
  TARGET_EASE: 0.87,
  TARGET_EPS: 0.05,
  FRICTION: 0.94,
  VEL_EPS: 0.002,
  /** rotation au repos, en degrés par ms */
  IDLE_SPEED: 0.005,
  IDLE_DELAY_MS: 2500,
  DRAG_GAIN: 0.45,
  DRAG_THRESHOLD_PX: 6,
  /** clic ignoré juste après un glissé */
  TAP_SUPPRESS_MS: 60,
  OPEN_SHEET_DELAY_MS: 650,
  FRAME_MS: 16.7,
  BOX_W: 340,
  BOX_H: 370,
  /** échelle minimale du dessin (en dessous, la scène défile) */
  MIN_SCALE: 0.5,
  LABEL_SCALE_BASE: 0.8,
  LABEL_SCALE_GAIN: 0.32,
} as const;

export interface SpinState {
  spin: number;
  vel: number;
  target: number | null;
  /** dernier contact (doigt, tap) : retarde la rotation au repos */
  lastTouch: number;
}

export function createSpin(): SpinState {
  return { spin: TABLE.START_SPIN, vel: 0, target: null, lastTouch: 0 };
}

/** Angle à viser pour amener la chaise i devant, par le chemin le plus court. */
export function seatTarget(current: number, i: number): number {
  let t = -i * TABLE.SEAT_ANGLE;
  t += 360 * Math.round((current - t) / 360);
  return t + 0; // évite -0
}

export interface StepFlags {
  dragging: boolean;
  /** feuille ouverte ou chaise tirée : pas de rotation au repos */
  paused: boolean;
}

export function stepSpin(s: SpinState, dt: number, now: number, f: StepFlags): void {
  if (s.target !== null) {
    s.spin += (s.target - s.spin) * (1 - Math.pow(TABLE.TARGET_EASE, dt / TABLE.FRAME_MS));
    if (Math.abs(s.target - s.spin) < TABLE.TARGET_EPS) {
      s.spin = s.target;
      s.target = null;
    }
  } else if (!f.dragging) {
    if (Math.abs(s.vel) > TABLE.VEL_EPS) {
      s.spin += s.vel * dt;
      s.vel *= Math.pow(TABLE.FRICTION, dt / TABLE.FRAME_MS);
    } else if (!f.paused && now - s.lastTouch > TABLE.IDLE_DELAY_MS) {
      s.spin += dt * TABLE.IDLE_SPEED;
    }
  }
}

/** Angles du plateau pour la position de navigation p (la table s'incline en arrivant). */
export function worldAngles(
  spin: number,
  p: number,
  scene: number = TABLE.TABLE_SCENE,
): { tilt: number; spin: number } {
  const o = scene - p;
  return { tilt: TABLE.TILT - Math.abs(o) * TABLE.TILT_TRAVEL, spin: spin + o * TABLE.SPIN_TRAVEL };
}

/** Échelle du dessin (340 × 370) pour tenir dans la place laissée par la scène (.t-stage). */
export function fitScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  const s = Math.min(1, width / TABLE.BOX_W, height / TABLE.BOX_H);
  return Math.max(TABLE.MIN_SCALE, Math.round(s * 1000) / 1000);
}

export function labelScale(y: number): number {
  return TABLE.LABEL_SCALE_BASE + (TABLE.LABEL_SCALE_GAIN * y) / TABLE.BOX_H;
}

// ---------------------------------------------------------------------------
//  Partie DOM
// ---------------------------------------------------------------------------

export interface TableOptions {
  mode: () => MotionMode;
  /** feuille ouverte ou chaise tirée */
  isPaused: () => boolean;
  onTap: (i: number) => void;
}

export interface TableController {
  /** à appeler à chaque image avec la position de navigation */
  tick(dt: number, now: number, p: number): void;
  /** amène la chaise i devant (rotation) */
  bringToFront(i: number): void;
  destroy(): void;
}

interface Drag {
  x: number;
  spin: number;
  lx: number;
  lt: number;
  moved: boolean;
  id: number;
}

export function init(box: HTMLElement, options: TableOptions): TableController {
  const world = box.querySelector<HTMLElement>('[data-world]');
  const anchors = Array.from(box.querySelectorAll<HTMLElement>('[data-anchor]'));
  const labels = Array.from(box.querySelectorAll<HTMLElement>('[data-label]'));
  const s = createSpin();
  let drag: Drag | null = null;
  let suppressUntil = 0;

  const fixed = () => options.mode() === 'reduced';

  const onDown = (e: PointerEvent) => {
    if (fixed()) return;
    drag = {
      x: e.clientX,
      spin: s.spin,
      lx: e.clientX,
      lt: performance.now(),
      moved: false,
      id: e.pointerId,
    };
    s.target = null;
    s.vel = 0;
    s.lastTouch = performance.now();
  };
  const onMove = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > TABLE.DRAG_THRESHOLD_PX) {
      if (!d.moved) box.setPointerCapture?.(e.pointerId);
      d.moved = true;
    }
    if (!d.moved) return;
    const now = performance.now();
    s.vel = ((e.clientX - d.lx) * TABLE.DRAG_GAIN) / Math.max(1, now - d.lt);
    d.lx = e.clientX;
    d.lt = now;
    s.spin = d.spin + dx * TABLE.DRAG_GAIN;
    s.lastTouch = now;
  };
  const onUp = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    drag = null;
    if (d.moved) {
      suppressUntil = performance.now() + TABLE.TAP_SUPPRESS_MS;
      // mode économie : la 3D reste, mais sans inertie
      if (options.mode() !== 'full') s.vel = 0;
    } else s.vel = 0;
  };
  const onClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-seat],[data-chair]');
    if (!el || performance.now() < suppressUntil) return;
    const i = Number(el.dataset.seat ?? el.dataset.chair);
    if (Number.isInteger(i)) options.onTap(i);
  };
  box.addEventListener('pointerdown', onDown);
  box.addEventListener('pointermove', onMove);
  box.addEventListener('pointerup', onUp);
  box.addEventListener('pointercancel', onUp);
  box.addEventListener('click', onClick);

  let lastP = Number.NaN;
  const scene = Number(box.closest<HTMLElement>('[data-scene]')?.dataset.scene ?? TABLE.TABLE_SCENE);

  // Le dessin suit la place disponible (rotation de l'écran, barre d'adresse qui se replie…).
  const stage = box.parentElement;
  const fit = () => {
    if (!stage) return;
    box.style.setProperty('--ts', String(fitScale(stage.clientWidth, stage.clientHeight)));
    lastP = Number.NaN; // replace les noms au prochain rendu
  };
  fit();
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
  if (stage) resize?.observe(stage);

  const ctl: TableController = {
    tick(dt, now, p) {
      if (!world || Math.abs(p - scene) >= 1) return;
      if (!fixed()) stepSpin(s, dt, now, { dragging: drag !== null, paused: options.isPaused() });
      else if (s.target !== null) {
        s.spin = s.target;
        s.target = null;
      }
      if (fixed() && p === lastP && s.target === null) return;
      lastP = p;
      const a = worldAngles(s.spin, p, scene);
      world.style.transform = `rotateX(${a.tilt.toFixed(2)}deg) rotateZ(${a.spin.toFixed(2)}deg)`;
      world.style.setProperty('--spin', `${a.spin.toFixed(2)}deg`);
      world.style.setProperty('--tilt', `${a.tilt.toFixed(2)}deg`);
      const cr = box.getBoundingClientRect();
      const scale = cr.width / (box.offsetWidth || 1);
      anchors.forEach((anchor) => {
        const lb = labels[Number(anchor.dataset.anchor)];
        if (!lb) return;
        const r = anchor.getBoundingClientRect();
        const x = (r.left - cr.left) / scale + 1;
        const y = (r.top - cr.top) / scale + 1;
        lb.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${labelScale(y).toFixed(3)})`;
        lb.style.zIndex = String(Math.round(y));
      });
    },
    bringToFront(i) {
      s.target = fixed() ? null : seatTarget(s.spin, i);
      s.vel = 0;
      s.lastTouch = performance.now();
      lastP = Number.NaN;
    },
    destroy() {
      resize?.disconnect();
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp);
      box.removeEventListener('pointercancel', onUp);
      box.removeEventListener('click', onClick);
    },
  };
  return ctl;
}
