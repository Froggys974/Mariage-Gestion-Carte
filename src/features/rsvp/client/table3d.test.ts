import { describe, expect, it } from 'vitest';
import { createSpin, fitScale, labelScale, seatTarget, stepSpin, TABLE, worldAngles } from './table3d';

const run = (
  s: ReturnType<typeof createSpin>,
  frames: number,
  flags = { dragging: false, paused: false },
  t0 = 0,
) => {
  let now = t0;
  for (let i = 0; i < frames; i++) {
    now += TABLE.FRAME_MS;
    stepSpin(s, TABLE.FRAME_MS, now, flags);
  }
  return now;
};

describe('géométrie de la table 3D', () => {
  it('place les 6 chaises tous les 60°', () => {
    expect(TABLE.SEATS * TABLE.SEAT_ANGLE).toBe(360);
  });
  it('vise la chaise par le chemin le plus court', () => {
    expect(seatTarget(-20, 0)).toBe(0);
    expect(seatTarget(-20, 1)).toBe(-60);
    expect(seatTarget(-20, 5)).toBe(-300 + 360); // 60 : plus court que -300
    expect(seatTarget(700, 2)).toBe(-120 + 720);
  });
  it('incline la table en arrivant sur la scène', () => {
    expect(worldAngles(10, 3)).toEqual({ tilt: 58, spin: 10 });
    expect(worldAngles(10, 2, 2)).toEqual({ tilt: 58, spin: 10 });
    const a = worldAngles(10, 2.5);
    expect(a.tilt).toBeCloseTo(47);
    expect(a.spin).toBeCloseTo(50);
  });
  it('grossit les noms des chaises du premier plan', () => {
    expect(labelScale(0)).toBeCloseTo(0.8);
    expect(labelScale(370)).toBeCloseTo(1.12);
  });
  it('réduit le dessin pour tenir dans la place disponible, sans jamais l’agrandir', () => {
    expect(fitScale(400, 500)).toBe(1);
    expect(fitScale(288, 400)).toBeCloseTo(288 / 340, 3);
    expect(fitScale(358, 296)).toBeCloseTo(0.8, 3);
    expect(fitScale(100, 100)).toBe(TABLE.MIN_SCALE);
    expect(fitScale(0, 0)).toBe(1);
  });
});

describe('inertie et rotation', () => {
  it('rejoint la chaise visée puis s’arrête exactement', () => {
    const s = createSpin();
    s.target = seatTarget(s.spin, 2);
    run(s, 200, { dragging: false, paused: true });
    expect(s.target).toBeNull();
    expect(s.spin).toBe(-120);
  });
  it('l’élan décroît (friction 0,94 par image)', () => {
    const s = createSpin();
    s.vel = 0.5;
    stepSpin(s, TABLE.FRAME_MS, 0, { dragging: false, paused: false });
    expect(s.vel).toBeCloseTo(0.5 * 0.94);
    run(s, 400);
    expect(Math.abs(s.vel)).toBeLessThan(TABLE.VEL_EPS);
  });
  it('tourne doucement au repos après 2,5 s sans contact', () => {
    const s = createSpin();
    s.lastTouch = 0;
    stepSpin(s, TABLE.FRAME_MS, 1000, { dragging: false, paused: false });
    expect(s.spin).toBe(TABLE.START_SPIN);
    stepSpin(s, TABLE.FRAME_MS, 3000, { dragging: false, paused: false });
    expect(s.spin).toBeCloseTo(TABLE.START_SPIN + TABLE.FRAME_MS * TABLE.IDLE_SPEED);
  });
  it('ne tourne pas au repos quand une feuille est ouverte', () => {
    const s = createSpin();
    stepSpin(s, TABLE.FRAME_MS, 10_000, { dragging: false, paused: true });
    expect(s.spin).toBe(TABLE.START_SPIN);
  });
});
