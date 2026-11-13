import { describe, expect, it } from 'vitest';
import {
  createNav,
  currentScene,
  go,
  input,
  motionAmount,
  moteStyle,
  NAV,
  releaseVelocity,
  riseStyle,
  sceneStyle,
  snap,
  step,
  touchTarget,
} from './scene-nav';

/** Fait avancer la navigation jusqu'au repos (comme requestAnimationFrame à 60 i/s). */
function settle(s: ReturnType<typeof createNav>, from = 1000, frames = 600): number {
  let now = from;
  for (let i = 0; i < frames; i++) {
    now += NAV.FRAME_MS;
    step(s, NAV.FRAME_MS, now);
  }
  return now;
}

describe('calage (snap)', () => {
  it('revient à la section de départ sous le seuil de 0,15', () => {
    const s = createNav(1);
    s.tp = 1.12;
    snap(s);
    expect(s.tp).toBe(1);
  });
  it('passe à la section suivante au-delà de 0,15', () => {
    const s = createNav(1);
    s.tp = 1.2;
    snap(s);
    expect(s.tp).toBe(2);
    expect(s.base).toBe(2);
  });
  it('passe à la section précédente vers le haut', () => {
    const s = createNav(2);
    s.tp = 1.7;
    snap(s);
    expect(s.tp).toBe(1);
  });
  it('arrondit un grand geste (au-delà de 1,5)', () => {
    const s = createNav(0);
    s.tp = 2.8;
    snap(s);
    expect(s.tp).toBe(3);
  });
  it('reste dans les bornes 0…5', () => {
    const s = createNav(5);
    s.tp = 5.3;
    snap(s);
    expect(s.tp).toBe(5);
    const t = createNav(0);
    t.tp = -0.3;
    snap(t);
    expect(t.tp).toBe(0);
  });
  it('se déclenche ~150 ms après le dernier geste', () => {
    const s = createNav(0);
    input(s, 0.3, 1000);
    step(s, NAV.FRAME_MS, 1100);
    expect(s.snapPending).toBe(true);
    step(s, NAV.FRAME_MS, 1151);
    expect(s.snapPending).toBe(false);
    expect(s.tp).toBe(1);
  });
});

describe('suivi du geste (lerp)', () => {
  it('p rattrape tp progressivement puis se pose exactement', () => {
    const s = createNav(0);
    go(s, 1);
    step(s, NAV.FRAME_MS, 1000);
    expect(s.p).toBeGreaterThan(0);
    expect(s.p).toBeLessThan(1);
    settle(s);
    expect(s.p).toBe(1);
    expect(currentScene(s)).toBe(1);
  });
  it('suit plus vite le doigt (0,32) que le calage (0,1)', () => {
    const a = createNav(0);
    const b = createNav(0);
    a.tp = b.tp = 1;
    a.touching = true;
    step(a, NAV.FRAME_MS, 0);
    step(b, NAV.FRAME_MS, 0);
    expect(a.p).toBeCloseTo(0.32, 5);
    expect(b.p).toBeCloseTo(0.1, 5);
  });
  it('est indépendant de la fréquence d’images', () => {
    const a = createNav(0);
    const b = createNav(0);
    a.tp = b.tp = 1;
    step(a, NAV.FRAME_MS * 2, 0);
    step(b, NAV.FRAME_MS, 0);
    step(b, NAV.FRAME_MS, 0);
    expect(a.p).toBeCloseTo(b.p, 10);
  });
});

describe('molette et doigt', () => {
  it('amortit les rebonds aux extrémités (× 0,3)', () => {
    const s = createNav(0);
    input(s, -0.5, 0);
    expect(s.tp).toBeCloseTo(-0.15, 10);
    const e = createNav(5);
    input(e, 0.5, 0);
    expect(e.tp).toBeCloseTo(5.15, 10);
  });
  it('limite le dépassement à ±0,3', () => {
    const s = createNav(0);
    for (let i = 0; i < 20; i++) input(s, -1, 0);
    expect(s.tp).toBe(-0.3);
  });
  it('convertit le doigt : déplacement / (0,6 × hauteur)', () => {
    expect(touchTarget(1, 0.6 * 800, 800)).toBeCloseTo(2, 10);
    expect(touchTarget(0, -240, 800)).toBeCloseTo(-0.15, 10);
  });
  it('ajoute l’inertie au relâchement : vitesse × 200 ms', () => {
    // 1,2 px/ms sur un écran de 800 px → 1,2 × 200 / 480 = 0,5 section
    expect(releaseVelocity(1, 1.2, 800)).toBeCloseTo(1.5, 10);
  });
  it('un lancer rapide fait passer à la section suivante', () => {
    const s = createNav(1);
    s.touching = true;
    s.tp = touchTarget(1, 40, 800);
    s.touching = false;
    s.tp = releaseVelocity(s.tp, 1, 800);
    s.snapPending = true;
    s.lastInput = 0;
    settle(s);
    expect(s.p).toBe(2);
  });
});

describe('style des scènes', () => {
  it('scène suivante : recule en Z et descend', () => {
    const st = sceneStyle(1, 0.5);
    expect(st.z).toBeCloseTo(-700);
    expect(st.y).toBeCloseTo(40);
    expect(st.opacity).toBeCloseTo(0.5);
    expect(st.front).toBe(false);
  });
  it('scène précédente : passe devant', () => {
    const st = sceneStyle(0, 0.5);
    expect(st.z).toBeCloseTo(280);
    expect(st.y).toBeCloseTo(-25);
    expect(st.front).toBe(true);
  });
  it('cache les scènes éloignées et rend interactive la scène calée', () => {
    expect(sceneStyle(3, 0).visible).toBe(false);
    expect(sceneStyle(0, 0).interactive).toBe(true);
    expect(sceneStyle(1, 0.5).interactive).toBe(false);
  });
  it('en mouvement réduit : simple fondu', () => {
    const st = sceneStyle(1, 0.5, true);
    expect(st.y).toBe(0);
    expect(st.z).toBe(0);
    expect(st.opacity).toBeCloseTo(0.5);
  });
  it('décale les éléments [data-rise] selon leur rang', () => {
    expect(riseStyle(0, 3)).toBeNull();
    const r = riseStyle(0.5, 2);
    expect(r?.y).toBeCloseTo(0.5 * (24 + 60));
    expect(r?.opacity).toBeCloseTo(1 - 0.5 * 1.28);
  });
});

describe('particules', () => {
  it('invisibles au repos, visibles en mouvement', () => {
    expect(motionAmount(2, 2)).toBe(0);
    expect(motionAmount(1.5, 2)).toBe(1);
  });
  it('bouclent en Z sur une période de 2600', () => {
    const a = moteStyle(100, 0, 1);
    const b = moteStyle(100, 2600 / 1100, 1);
    expect(a.z).toBeCloseTo(b.z, 6);
  });
});
