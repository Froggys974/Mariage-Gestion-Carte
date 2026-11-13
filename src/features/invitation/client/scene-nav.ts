/**
 * Navigation en profondeur entre les scènes (logique du prototype Faire-part v3, reprise telle quelle).
 *
 * La position est un nombre continu `p` entre 0 et 5. Molette et doigt déplacent une cible `tp` ;
 * à chaque image, `p` rattrape `tp` : la scène SUIT le geste, puis se cale sur la section la plus proche.
 *
 * Partie pure (testée) : createNav, input, snap, step, go, sceneStyle, riseStyle, releaseVelocity, moteStyle.
 * Partie DOM : init(root, options) → { go, destroy, … }.
 */

export const NAV = {
  SCENES: 6,
  /** molette : deltaY / 560 */
  WHEEL_DIVISOR: 560,
  /** doigt : déplacement / (0,6 × hauteur de l'écran) */
  TOUCH_SPAN: 0.6,
  LERP_TOUCH: 0.32,
  LERP_SNAP: 0.1,
  LERP_INPUT: 0.16,
  LERP_GO: 0.07,
  /** calage ~150 ms après le dernier geste */
  SNAP_DELAY_MS: 150,
  /** au-delà de 0,15 on passe à la section suivante */
  SNAP_THRESHOLD: 0.15,
  /** au-delà de 1,5 section parcourue, on arrondit */
  MULTI_JUMP: 1.5,
  /** inertie au doigt : vitesse × 200 ms */
  INERTIA_MS: 200,
  /** rebond amorti aux extrémités */
  EDGE_DAMPING: 0.3,
  OVERSHOOT: 0.3,
  AXIS_LOCK_PX: 10,
  SETTLE_EPS: 0.0004,
  FRAME_MS: 16.7,
  DT_MAX_MS: 50,
  NEXT_Y: 80,
  NEXT_Z: 1400,
  PREV_Y: 50,
  PREV_Z: 560,
  PREV_FADE: 1.3,
  /** seule la scène presque calée reçoit les clics */
  INTERACTIVE_BAND: 0.3,
  /** relais setInterval si requestAnimationFrame est suspendu (webviews) */
  FALLBACK_INTERVAL_MS: 100,
  FALLBACK_STALL_MS: 120,
  RISE_BASE_Y: 24,
  RISE_STEP_Y: 30,
  RISE_FADE_STEP: 0.14,
  /** marge de scroll natif considérée comme « en haut / en bas » */
  EDGE_PX: 2,
  WHEEL_SETTLED: 0.02,
  /** pixels de deltaY pour une ligne (deltaMode = 1) */
  WHEEL_LINE_PX: 16,
} as const;

const LAST = NAV.SCENES - 1;

export interface NavState {
  p: number;
  tp: number;
  base: number;
  lerp: number;
  snapPending: boolean;
  touching: boolean;
  lastInput: number;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const smoothstep = (x: number): number => x * x * (3 - 2 * x);

export function createNav(initial = 0): NavState {
  const i = clamp(Math.round(initial), 0, LAST);
  return { p: i, tp: i, base: i, lerp: NAV.LERP_SNAP, snapPending: false, touching: false, lastInput: 0 };
}

/** Molette / clavier continu : déplace la cible, avec rebond amorti aux extrémités. */
export function input(s: NavState, delta: number, now: number): void {
  let d = delta;
  if ((s.tp <= 0 && d < 0) || (s.tp >= LAST && d > 0)) d *= NAV.EDGE_DAMPING;
  s.tp = clamp(s.tp + d, -NAV.OVERSHOOT, LAST + NAV.OVERSHOOT);
  s.lastInput = now;
  s.snapPending = true;
  s.lerp = NAV.LERP_INPUT;
}

/** Calage sur la section la plus proche. */
export function snap(s: NavState): void {
  s.snapPending = false;
  const d = s.tp - s.base;
  let t = s.base;
  if (Math.abs(d) > NAV.SNAP_THRESHOLD) {
    t = Math.abs(d) < NAV.MULTI_JUMP ? s.base + Math.sign(d) : s.base + Math.round(d);
  }
  t = clamp(t, 0, LAST);
  s.tp = t;
  s.base = t;
  s.lerp = NAV.LERP_SNAP;
}

/** Aller directement à une section (points, menu, boutons). */
export function go(s: NavState, i: number): void {
  const t = clamp(Math.round(i), 0, LAST);
  s.tp = t;
  s.base = t;
  s.snapPending = false;
  s.lerp = NAV.LERP_GO;
}

/** Avance d'une image. Renvoie vrai si `p` a bougé. */
export function step(s: NavState, dt: number, now: number): boolean {
  if (!s.touching && s.snapPending && now - s.lastInput > NAV.SNAP_DELAY_MS) snap(s);
  const k = 1 - Math.pow(1 - (s.touching ? NAV.LERP_TOUCH : s.lerp), dt / NAV.FRAME_MS);
  const before = s.p;
  s.p += (s.tp - s.p) * k;
  if (Math.abs(s.tp - s.p) < NAV.SETTLE_EPS) s.p = s.tp;
  return s.p !== before;
}

/** Position courante arrondie (scène affichée). */
export function currentScene(s: NavState): number {
  return clamp(Math.round(s.p), 0, LAST);
}

/** Cible au doigt : déplacement vertical rapporté à 0,6 × hauteur, rebond amorti. */
export function touchTarget(startTp: number, dyPx: number, viewportH: number): number {
  let tp = startTp + dyPx / (viewportH * NAV.TOUCH_SPAN);
  if (tp < 0) tp *= NAV.EDGE_DAMPING;
  if (tp > LAST) tp = LAST + (tp - LAST) * NAV.EDGE_DAMPING;
  return tp;
}

/** Inertie au relâchement : vitesse (px/ms) × 200 ms, rapportée à la hauteur parcourue. */
export function releaseVelocity(tp: number, velocityPxPerMs: number, viewportH: number): number {
  return tp + (velocityPxPerMs / (viewportH * NAV.TOUCH_SPAN)) * NAV.INERTIA_MS;
}

export interface SceneStyle {
  visible: boolean;
  interactive: boolean;
  y: number;
  z: number;
  opacity: number;
  front: boolean;
}

/**
 * Style de la scène i pour la position p.
 * o ≥ 0 (suivante) : translate3d(0, o·80, −o·1400), opacité 1 − smoothstep(o)
 * o < 0 (précédente, passe devant) : translate3d(0, −q·50, q·560), opacité 1 − smoothstep(q·1,3)
 * `flat` (mouvement réduit) : simple fondu, sans déplacement.
 */
export function sceneStyle(i: number, p: number, flat = false): SceneStyle {
  const o = i - p;
  if (Math.abs(o) >= 1) return { visible: false, interactive: false, y: 0, z: 0, opacity: 0, front: false };
  let y: number;
  let z: number;
  let opacity: number;
  if (o >= 0) {
    z = -o * NAV.NEXT_Z;
    y = o * NAV.NEXT_Y;
    opacity = 1 - smoothstep(o);
  } else {
    const q = -o;
    z = q * NAV.PREV_Z;
    y = -q * NAV.PREV_Y;
    opacity = 1 - smoothstep(Math.min(1, q * NAV.PREV_FADE));
  }
  if (flat) {
    y = 0;
    z = 0;
  }
  return { visible: true, interactive: Math.abs(o) < NAV.INTERACTIVE_BAND, y, z, opacity, front: o < 0 };
}

/** Décalage des éléments [data-rise] de la scène qui arrive, selon leur rang k. null = style par défaut. */
export function riseStyle(o: number, k: number): { y: number; opacity: number } | null {
  if (o <= 0.001) return null;
  return {
    y: o * (NAV.RISE_BASE_Y + k * NAV.RISE_STEP_Y),
    opacity: Math.max(0, 1 - o * (1 + k * NAV.RISE_FADE_STEP)),
  };
}

export const MOTES = {
  Z_SCALE: 1.44,
  Z_SPEED: 1100,
  Z_PERIOD: 2600,
  Z_OFFSET: 1900,
  NEAR_FADE_START: 450,
  NEAR_FADE_LEN: 250,
  FAR_FADE_LEN: 500,
  MOTION_GAIN: 3.4,
  LAG_GAIN: 1.2,
} as const;

/** Particules : défilent en Z selon p, visibles seulement pendant le mouvement. */
export function motionAmount(p: number, tp: number): number {
  const frac = Math.abs(p - Math.round(p));
  return Math.min(1, frac * MOTES.MOTION_GAIN + Math.abs(tp - p) * MOTES.LAG_GAIN);
}

export function moteStyle(z0: number, p: number, motion: number): { z: number; opacity: number } {
  const P = MOTES.Z_PERIOD;
  const z = ((((z0 + p * MOTES.Z_SPEED) % P) + P) % P) - MOTES.Z_OFFSET;
  const fade =
    z > MOTES.NEAR_FADE_START
      ? Math.max(0, 1 - (z - MOTES.NEAR_FADE_START) / MOTES.NEAR_FADE_LEN)
      : Math.min(1, (z + MOTES.Z_OFFSET) / MOTES.FAR_FADE_LEN);
  return { z, opacity: motion * fade };
}

// ---------------------------------------------------------------------------
//  Partie DOM
// ---------------------------------------------------------------------------

export interface NavOptions {
  /** conteneur des scènes ([data-scene="0…5"]) */
  stage: HTMLElement;
  /** calque des particules ([data-mote]) */
  motes?: HTMLElement | null;
  initial?: number;
  /** fondus simples, sans profondeur (prefers-reduced-motion) */
  flat?: boolean;
  /** gestes ignorés (intro, menu, feuille ouverte) */
  isBlocked: () => boolean;
  onSceneChange: (i: number) => void;
  /** appelé à chaque image (table 3D, mesure des fps) */
  onFrame?: (dt: number, now: number, p: number, moving: boolean) => void;
}

export interface NavController {
  go(i: number): void;
  readonly state: NavState;
  setFlat(flat: boolean): void;
  /** recalcule la liste des éléments [data-rise] (après un changement de contenu) */
  refresh(): void;
  destroy(): void;
}

interface TouchTrack {
  x: number;
  y: number;
  tp: number;
  axis: 'x' | 'y' | 'n' | null;
  top: boolean;
  bottom: boolean;
  ly: number;
  lt: number;
  v: number;
}

export function init(root: HTMLElement, options: NavOptions): NavController {
  const s = createNav(options.initial ?? 0);
  let flat = options.flat ?? false;
  const scenes = Array.from({ length: NAV.SCENES }, (_, i) =>
    options.stage.querySelector<HTMLElement>(`[data-scene="${i}"]`),
  );
  let kids: HTMLElement[][] = [];
  const refresh = () => {
    kids = scenes.map((el) => (el ? Array.from(el.querySelectorAll<HTMLElement>('[data-rise]')) : []));
  };
  refresh();
  const motes = options.motes
    ? Array.from(options.motes.querySelectorAll<HTMLElement>('[data-mote]')).map((el) => ({
        el,
        z0: Number(el.dataset.z ?? 0) * MOTES.Z_SCALE,
      }))
    : [];

  let drawnP: number | null = null;
  let scene = currentScene(s);
  let moving = false;

  const apply = () => {
    const p = s.p;
    for (let i = 0; i < NAV.SCENES; i++) {
      const el = scenes[i];
      if (!el) continue;
      const st = sceneStyle(i, p, flat);
      if (!st.visible) {
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        continue;
      }
      el.style.visibility = 'visible';
      el.style.pointerEvents = st.interactive ? 'auto' : 'none';
      el.style.transform = `translate3d(0,${st.y.toFixed(1)}px,${st.z.toFixed(1)}px)`;
      el.style.opacity = st.opacity.toFixed(3);
      el.style.zIndex = st.front ? '3' : '2';
      el.inert = !st.interactive;
      const o = i - p;
      kids[i]?.forEach((n, k) => {
        const r = flat ? null : riseStyle(o, k);
        if (r) {
          n.style.transform = `translate3d(0,${r.y.toFixed(1)}px,0)`;
          n.style.opacity = r.opacity.toFixed(3);
        } else if (n.style.opacity !== '') {
          n.style.transform = '';
          n.style.opacity = '';
        }
      });
    }
    if (motes.length) {
      const motion = motionAmount(p, s.tp);
      for (const m of motes) {
        const st = moteStyle(m.z0, p, motion);
        m.el.style.transform = `translateZ(${st.z.toFixed(0)}px)`;
        m.el.style.opacity = st.opacity.toFixed(3);
      }
    }
  };

  const setMoving = (m: boolean) => {
    if (m === moving) return;
    moving = m;
    // will-change seulement pendant le mouvement
    options.stage.classList.toggle('is-moving', m);
  };

  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(NAV.DT_MAX_MS, now - last);
    last = now;
    step(s, dt, now);
    if (s.p !== drawnP) {
      apply();
      drawnP = s.p;
    }
    setMoving(s.p !== s.tp || s.touching);
    const sc = currentScene(s);
    if (sc !== scene) {
      scene = sc;
      options.onSceneChange(sc);
    }
    options.onFrame?.(dt, now, s.p, moving);
  };
  let raf = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    tick(now);
  };
  raf = requestAnimationFrame(loop);
  // Relais si requestAnimationFrame est suspendu (webviews, onglet en arrière-plan)
  const fallback = window.setInterval(() => {
    const now = performance.now();
    if (now - last > NAV.FALLBACK_STALL_MS) tick(now);
  }, NAV.FALLBACK_INTERVAL_MS);
  apply();
  drawnP = s.p;

  const sceneEl = () => scenes[currentScene(s)] ?? null;

  const onWheel = (e: WheelEvent) => {
    if (options.isBlocked()) return;
    const dy = e.deltaMode === 1 ? e.deltaY * NAV.WHEEL_LINE_PX : e.deltaY;
    const el = sceneEl();
    const settled = Math.abs(s.p - Math.round(s.p)) < NAV.WHEEL_SETTLED && !s.snapPending;
    if (el && settled) {
      // le scroll natif de la scène est prioritaire tant qu'elle n'est pas en haut ou en bas
      const canDown = el.scrollHeight - el.clientHeight - el.scrollTop > NAV.EDGE_PX;
      const canUp = el.scrollTop > NAV.EDGE_PX;
      if ((dy > 0 && canDown) || (dy < 0 && canUp)) return;
    }
    input(s, dy / NAV.WHEEL_DIVISOR, performance.now());
  };

  let ts: TouchTrack | null = null;
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const el = sceneEl();
    ts = {
      x: t.clientX,
      y: t.clientY,
      tp: s.tp,
      axis: null,
      top: !el || el.scrollTop < NAV.EDGE_PX,
      bottom: !el || el.scrollHeight - el.clientHeight - el.scrollTop < NAV.EDGE_PX,
      ly: t.clientY,
      lt: performance.now(),
      v: 0,
    };
  };
  const onTouchMove = (e: TouchEvent) => {
    const tr = ts;
    const t = e.touches[0];
    if (!tr || !t || options.isBlocked()) return;
    const dx = t.clientX - tr.x;
    const dy = tr.y - t.clientY;
    if (!tr.axis) {
      if (Math.hypot(dx, dy) < NAV.AXIS_LOCK_PX) return;
      tr.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
      if (tr.axis === 'y' && !((dy > 0 && tr.bottom) || (dy < 0 && tr.top))) tr.axis = 'n';
      if (tr.axis === 'y') {
        tr.y = t.clientY;
        tr.tp = s.tp;
      }
    }
    if (tr.axis !== 'y') return;
    const now = performance.now();
    tr.v = (tr.ly - t.clientY) / Math.max(1, now - tr.lt);
    tr.ly = t.clientY;
    tr.lt = now;
    s.touching = true;
    s.tp = touchTarget(tr.tp, tr.y - t.clientY, window.innerHeight);
    s.lastInput = now;
    s.snapPending = true;
  };
  const onTouchEnd = () => {
    const tr = ts;
    ts = null;
    s.touching = false;
    if (!tr || tr.axis !== 'y') return;
    s.tp = releaseVelocity(s.tp, tr.v, window.innerHeight);
    s.lastInput = 0;
  };
  const onKey = (e: KeyboardEvent) => {
    if (options.isBlocked()) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const el = sceneEl();
    const scrollable = el ? el.scrollHeight - el.clientHeight > NAV.EDGE_PX : false;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      if (scrollable && el && el.scrollHeight - el.clientHeight - el.scrollTop > NAV.EDGE_PX) return;
      e.preventDefault();
      go(s, currentScene(s) + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      if (scrollable && el && el.scrollTop > NAV.EDGE_PX) return;
      e.preventDefault();
      go(s, currentScene(s) - 1);
    }
  };

  root.addEventListener('wheel', onWheel, { passive: true });
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchmove', onTouchMove, { passive: true });
  root.addEventListener('touchend', onTouchEnd, { passive: true });
  root.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKey);

  return {
    go: (i: number) => go(s, i),
    state: s,
    setFlat(v: boolean) {
      flat = v;
      drawnP = null;
    },
    refresh,
    destroy() {
      cancelAnimationFrame(raf);
      clearInterval(fallback);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    },
  };
}
