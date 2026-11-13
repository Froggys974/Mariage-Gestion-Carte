import { describe, expect, it } from 'vitest';
import { canvasText, isInAppBrowser, layout, spacedDate } from './card-png';
import { ENVELOPE, FLAPS, timeline } from './envelope';

describe('séquence d’ouverture', () => {
  it('ouvre les 4 rabats dans l’ordre haut, bas, droite, gauche à 170 ms d’écart', () => {
    expect(FLAPS.map((f) => f[0])).toEqual(['t', 'b', 'r', 'l']);
    expect(timeline(0).flaps).toEqual([420, 590, 760, 930]);
  });
  it('fait apparaître les lignes à 110 ms d’écart et se termine à 2 s', () => {
    const t = timeline(7);
    expect(t.lines[1]! - t.lines[0]!).toBe(110);
    expect(t.done).toBe(2000);
    expect(ENVELOPE.SEAL_MS).toBe(650);
  });
  it('les rabats finissent retournés à 180°', () => {
    for (const [, , , to] of FLAPS) expect(to).toMatch(/180deg/);
  });
});

describe('image PNG de la carte', () => {
  it('espace les chiffres de la date comme le prototype', () => {
    expect(spacedDate('19 · 12 · 2026')).toBe('1 9   ·   1 2   ·   2 0 2 6');
  });
  it('garde la mise en page du prototype sans photo', () => {
    const l = layout(false);
    expect([l.date, l.name1, l.amp, l.name2, l.times, l.msg[0]]).toEqual([300, 470, 562, 664, 950, 1120]);
  });
  it('réserve la place de la photo quand il y en a une', () => {
    const l = layout(true);
    expect(l.photo).not.toBeNull();
    expect(l.photo!.y).toBeGreaterThan(l.times);
    expect(l.msg[0]).toBeGreaterThan(l.photo!.y + l.photo!.h);
  });
  it('remplace les caractères absents des polices du canvas', () => {
    expect(canvasText('Saint\u2011Pierre')).toBe('Saint-Pierre');
  });
  it('détecte les navigateurs intégrés à WhatsApp, Instagram, Facebook', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit Instagram 300.0')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 13; wv) WhatsApp/2.24')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 [FBAN/FBIOS;FBAV/450.0]')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/604.1')).toBe(
      false,
    );
  });
});
