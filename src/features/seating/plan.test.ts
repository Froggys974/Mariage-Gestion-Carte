import { describe, expect, it } from 'vitest';
import { clampSeats, clampTablePosition, tableGeometry, TABLE_GEOM } from './plan-geometry';
import {
  dropPerson,
  edgeScrollSpeed,
  parseSeatKey,
  placedOf,
  removeTable,
  seatInitials,
  seatKey,
  shortName,
  trimTable,
} from './plan-ops';

describe('géométrie des chaises', () => {
  it('table ronde : rayon max(42, n·7,5), chaises à rayon + 26, la 1re en haut', () => {
    const g = tableGeometry({ shape: 'round', n: 8 });
    expect(g.w).toBe(120);
    expect(g.seats).toHaveLength(8);
    const [x0, y0] = g.seats[0]!;
    expect(x0).toBeCloseTo(0);
    expect(y0).toBeCloseTo(-(60 + 26));
    for (const [x, y] of g.seats) expect(Math.hypot(x, y)).toBeCloseTo(86);
  });
  it('petite table ronde : rayon minimal 42', () => {
    expect(tableGeometry({ shape: 'round', n: 2 }).w).toBe(84);
  });
  it('table rectangulaire : chaises réparties dessus et dessous', () => {
    const g = tableGeometry({ shape: 'rect', n: 7 });
    expect(g.w).toBe(4 * 46);
    expect(g.h).toBe(66);
    const above = g.seats.filter(([, y]) => y < 0);
    const below = g.seats.filter(([, y]) => y > 0);
    expect(above).toHaveLength(4);
    expect(below).toHaveLength(3);
    expect(above[0]![1]).toBe(-33 - 25);
    expect(above[0]![0]).toBeCloseTo(-92 + 23);
  });
  it('largeur minimale 110 pour une petite table rectangulaire', () => {
    expect(tableGeometry({ shape: 'rect', n: 2 }).w).toBe(110);
  });
  it('borne les chaises (2 à 24) et la position dans la salle', () => {
    expect(clampSeats(1)).toBe(TABLE_GEOM.MIN_SEATS);
    expect(clampSeats(40)).toBe(24);
    expect(clampSeats(24)).toBe(24);
    expect(clampTablePosition(0, 2000)).toEqual({ x: 60, y: 710 });
  });
});

describe('permutation des chaises', () => {
  const t1 = seatKey('t1', 0);
  const t2 = seatKey('t1', 1);
  it('pose une personne sur une chaise libre', () => {
    expect(dropPerson({}, 'p1', null, t1)).toEqual({ [t1]: 'p1' });
  });
  it('déplace une personne : elle quitte sa chaise précédente', () => {
    expect(dropPerson({ [t1]: 'p1' }, 'p1', t1, t2)).toEqual({ [t2]: 'p1' });
  });
  it('déposer sur une chaise occupée échange les deux personnes', () => {
    expect(dropPerson({ [t1]: 'p1', [t2]: 'p2' }, 'p1', t1, t2)).toEqual({ [t1]: 'p2', [t2]: 'p1' });
  });
  it('depuis la liste, sur une chaise occupée : l’occupant retourne dans la liste', () => {
    expect(dropPerson({ [t1]: 'p1' }, 'p3', null, t1)).toEqual({ [t1]: 'p3' });
  });
  it('ramener une personne dans la liste la retire', () => {
    expect(dropPerson({ [t1]: 'p1', [t2]: 'p2' }, 'p1', t1, null)).toEqual({ [t2]: 'p2' });
  });
  it('une personne n’occupe jamais deux chaises', () => {
    let a = {};
    a = dropPerson(a, 'p1', null, t1);
    a = dropPerson(a, 'p1', null, t2);
    expect([...placedOf(a).keys()]).toEqual(['p1']);
  });
  it('libère les chaises supprimées et les tables supprimées', () => {
    const a = { [seatKey('t1', 0)]: 'a', [seatKey('t1', 7)]: 'b', [seatKey('t2', 0)]: 'c' };
    expect(trimTable(a, 't1', 4)).toEqual({ [seatKey('t1', 0)]: 'a', [seatKey('t2', 0)]: 'c' });
    expect(removeTable(a, 't1')).toEqual({ [seatKey('t2', 0)]: 'c' });
  });
  it('lit les clés de chaise (identifiants avec tirets)', () => {
    expect(parseSeatKey('0f6b-1:12')).toEqual({ tableId: '0f6b-1', index: 12 });
    expect(parseSeatKey('nope')).toBeNull();
  });
  it('initiales et nom court du prototype', () => {
    expect(seatInitials('Jean Luc', '')).toBe('JL');
    expect(seatInitials('Marie-Ange', '')).toBe('MA');
    // défilement automatique pendant le glisser : nul au centre, croissant vers les bords
    expect(edgeScrollSpeed(400, 800)).toBe(0);
    expect(edgeScrollSpeed(0, 800)).toBe(-18);
    expect(edgeScrollSpeed(800, 800)).toBe(18);
    expect(edgeScrollSpeed(-50, 800)).toBe(-18);
    expect(edgeScrollSpeed(780, 800)).toBeGreaterThan(0);
    expect(seatInitials('Léa', '')).toBe('L');
    expect(seatInitials('Léa', 'Payet')).toBe('LP');
    expect(shortName('Léa', 'Payet')).toBe('Léa P.');
  });
});
