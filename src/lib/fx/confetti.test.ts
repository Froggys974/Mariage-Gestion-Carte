import { describe, expect, it } from 'vitest';
import { petalPath } from './confetti';
import { seededRandom } from './flowers';

describe('confettis', () => {
  it('lancent les pétales vers le haut puis les font retomber', () => {
    const p = petalPath(Math.PI / 2, 100); // vers le bas de l'écran
    expect(p.dy).toBeCloseTo(40);
    expect(p.endY).toBeCloseTo(260);
    const up = petalPath(-Math.PI / 2, 100);
    expect(up.dy).toBeCloseTo(-160);
  });
  it('dérivent un peu plus loin horizontalement (× 1,25)', () => {
    const p = petalPath(0, 100);
    expect(p.endX).toBeCloseTo(125);
  });
});

describe('seededRandom', () => {
  it('reproduit la suite du prototype (graine 7)', () => {
    const r = seededRandom(7);
    expect(r()).toBeCloseTo((7 * 9301 + 49297) / 233280, 10);
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
