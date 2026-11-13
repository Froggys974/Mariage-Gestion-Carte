/**
 * Point d'entrée du site invité (TypeScript natif, aucun framework).
 * Orchestration : intro, navigation en profondeur, menu, points, halo, particules, fleurs au toucher,
 * faire-part, table 3D, feuilles (chaise, lien perdu, déclin).
 */
import { scenes as SCENE_NAMES } from '~/content/fr';
import * as confetti from '~/lib/fx/confetti';
import type { GuestBoot } from '../boot';
import * as particles from './particles';
import { chooseMode, createFpsMonitor, readCaps, type MotionMode } from './perf-mode';
import * as sceneNav from './scene-nav';
import { mountFeatures, type AppContext } from './features';

export const APP = {
  INTRO_RISE_MS: 3800,
  INTRO_END_MS: 4700,
  SKIP_RISE_MS: 50,
  RISE_DURATION_MS: 850,
  RISE_STAGGER_MS: 75,
  RISE_EASING: 'cubic-bezier(.2,.75,.2,1)',
  RISE_FROM: 'translateY(34px) scale(.96)',
  RISE_BLUR: 'blur(6px)',
  TAP_FLOWER_MIN: 30,
  TAP_FLOWER_RAND: 22,
  INTRO_SEEN_KEY: 'rcgn:intro',
  /** facteur de durée de l'intro selon html[data-intro] (voir guest.css) */
  INTRO_K: { full: 1, short: 0.4, reduced: 0.3, none: 0 } as Record<string, number>,
  /** halo de fond par scène : [x %, y %, couleur] */
  GLOW: [
    [50, 20, 'rgba(229,185,107,.16)'],
    [30, 55, 'rgba(233,84,79,.13)'],
    [38, 32, 'rgba(229,185,107,.15)'],
    [60, 45, 'rgba(43,138,126,.16)'],
    [72, 30, 'rgba(216,70,143,.13)'],
    [45, 75, 'rgba(229,185,107,.14)'],
  ] as const,
  /** éléments où un toucher ne fait pas éclore de fleur */
  NO_FLOWER: 'button,a,input,textarea,label,select,[data-seat],[data-table],[data-noflower]',
} as const;

function readBoot(): GuestBoot {
  const el = document.getElementById('guest-boot');
  return JSON.parse(el?.textContent ?? '{}') as GuestBoot;
}

function q<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(sel);
}

function start(): void {
  const root = q('[data-root]');
  const stage = q('[data-stage]');
  if (!root || !stage) return;
  const boot = readBoot();
  const params = new URLSearchParams(location.search);
  const html = document.documentElement;

  let mode: MotionMode = chooseMode(readCaps());
  const reduced = mode === 'reduced';
  html.dataset.motion = mode;

  // --- Calques décoratifs ---
  const floaterLayer = q('[data-floaters]', root);
  const moteLayer = q('[data-motes]', root);
  const decor =
    floaterLayer && moteLayer
      ? particles.init(floaterLayer, moteLayer, { economy: mode === 'economy', reduced })
      : null;
  const fxLayer = q('[data-fx]', root);
  const fx = fxLayer ? confetti.init(fxLayer, { economy: mode === 'economy', disabled: reduced }) : null;

  // --- État des surcouches ---
  const overlays = new Set<string>();
  let introOn = html.dataset.intro !== 'none';
  const isBlocked = () => introOn || overlays.size > 0;

  // --- Apparition des éléments [data-rise] ---
  const rise = (i: number, delay = 0) => {
    const el = q(`[data-scene="${i}"]`, stage);
    if (!el) return;
    el.scrollTop = 0;
    // l'accueil, caché pendant l'intro (html[data-intro-hold]), n'apparaît qu'avec son fondu
    html.removeAttribute('data-intro-hold');
    if (reduced) return;
    const blur = mode === 'full';
    el.querySelectorAll<HTMLElement>('[data-rise]').forEach((n, k) => {
      n.animate(
        [
          { opacity: 0, transform: APP.RISE_FROM, ...(blur ? { filter: APP.RISE_BLUR } : {}) },
          { opacity: 1, transform: 'none', ...(blur ? { filter: 'blur(0)' } : {}) },
        ],
        {
          duration: APP.RISE_DURATION_MS,
          delay: delay + k * APP.RISE_STAGGER_MS,
          easing: APP.RISE_EASING,
          fill: 'backwards',
        },
      );
    });
  };

  // --- Points, progression, halo ---
  const dots = Array.from(root.querySelectorAll<HTMLElement>('.g-dot'));
  const menuItems = Array.from(root.querySelectorAll<HTMLElement>('.g-menu__item'));
  const progress = q('[data-progress]', root);
  const swipe = q('[data-swipe]', root);
  const glow = q('[data-glow]', root);
  const sceneListeners: Array<(i: number) => void> = [];
  const onSceneChange = (i: number) => {
    dots.forEach((d, k) =>
      k === i ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current'),
    );
    menuItems.forEach((d, k) =>
      k === i ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current'),
    );
    if (progress) progress.textContent = `0${i + 1} · ${SCENE_NAMES[i] ?? ''}`;
    if (swipe) swipe.hidden = i >= SCENE_NAMES.length - 1;
    const g = APP.GLOW[i];
    if (glow && g) {
      glow.style.transform = `translate3d(${g[0]}vw,${g[1]}vh,0)`;
      glow.style.background = `radial-gradient(circle, ${g[2]}, transparent 55%)`;
    }
    sceneListeners.forEach((fn) => fn(i));
  };

  // --- Fluidité ---
  const frameListeners: Array<(dt: number, now: number, p: number) => void> = [];
  const fps = createFpsMonitor(() => {
    if (mode !== 'full') return;
    mode = 'economy';
    html.dataset.motion = mode;
    fx?.setEconomy(true);
    modeListeners.forEach((fn) => fn(mode));
  });
  const modeListeners: Array<(m: MotionMode) => void> = [];

  const initialScene = params.has('scene') ? Number(params.get('scene')) || 0 : 0;
  const nav = sceneNav.init(root, {
    stage,
    motes: moteLayer,
    initial: initialScene,
    flat: reduced,
    isBlocked,
    onSceneChange,
    onFrame(dt, now, p, moving) {
      fps.frame(dt, moving);
      for (const fn of frameListeners) fn(dt, now, p);
    },
  });
  onSceneChange(sceneNav.currentScene(nav.state));

  // --- Menu ---
  const menu = q('[data-menu]', root);
  const burger = q('[data-menu-open]', root);
  let menuReturn: HTMLElement | null = null;
  const setMenu = (open: boolean) => {
    if (!menu) return;
    menu.hidden = !open;
    burger?.setAttribute('aria-expanded', String(open));
    if (open) {
      overlays.add('menu');
      menuReturn = document.activeElement as HTMLElement | null;
      q<HTMLElement>('[data-menu-close]', menu)?.focus();
    } else {
      overlays.delete('menu');
      menuReturn?.focus?.();
    }
  };
  burger?.addEventListener('click', () => setMenu(true));
  q('[data-menu-close]', root)?.addEventListener('click', () => setMenu(false));

  const goTo = (i: number) => {
    setMenu(false);
    nav.go(i);
  };
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
    if (t) goTo(Number(t.dataset.go));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlays.has('menu')) setMenu(false);
  });

  // --- Fleur au toucher hors des contrôles ---
  root.addEventListener('pointerdown', (e) => {
    if (!fx || isBlocked() || reduced) return;
    const t = e.target as HTMLElement;
    if (t.closest(APP.NO_FLOWER)) return;
    fx.flower(e.clientX, e.clientY, APP.TAP_FLOWER_MIN + Math.random() * APP.TAP_FLOWER_RAND);
  });

  // --- Intro ---
  const introEl = q('[data-intro-el]', root);
  const k = APP.INTRO_K[html.dataset.intro ?? 'full'] ?? 1;
  let riseTimer = 0;
  let endTimer = 0;
  const endIntro = () => {
    introOn = false;
    introEl?.remove();
    try {
      localStorage.setItem(APP.INTRO_SEEN_KEY, '1');
    } catch {
      /* navigation privée */
    }
  };
  if (!introEl || k === 0) {
    introEl?.remove();
    introOn = false;
    window.setTimeout(() => rise(sceneNav.currentScene(nav.state)), APP.SKIP_RISE_MS);
  } else {
    riseTimer = window.setTimeout(() => rise(0), APP.INTRO_RISE_MS * k);
    endTimer = window.setTimeout(endIntro, APP.INTRO_END_MS * k);
    q('[data-intro-skip]', introEl)?.addEventListener('click', () => {
      clearTimeout(riseTimer);
      clearTimeout(endTimer);
      endIntro();
      rise(0);
    });
  }

  if (params.get('menu') === '1') setMenu(true);

  // --- Fonctionnalités (faire-part, table, feuilles) ---
  const ctx: AppContext = {
    boot,
    root,
    params,
    get mode() {
      return mode;
    },
    fx,
    nav,
    overlays,
    goTo,
    rise,
    onScene: (fn) => sceneListeners.push(fn),
    onFrame: (fn) => frameListeners.push(fn),
    onModeChange: (fn) => modeListeners.push(fn),
  };
  mountFeatures(ctx);

  window.addEventListener('pagehide', () => {
    nav.destroy();
    decor?.destroy();
    fx?.destroy();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
