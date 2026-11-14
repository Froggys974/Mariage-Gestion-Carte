import { describe, expect, it } from 'vitest';
import { SEAT_COUNT } from './boot';
import { fitSeats } from './invitation.service';

const p = (first: string) => ({ first, last: 'Payet', note: '' });
const table = (...seats: Array<ReturnType<typeof p> | null>) => [
  ...seats,
  ...Array.from({ length: SEAT_COUNT - seats.length }, () => null),
];

describe('chaises affichées selon le nombre de places', () => {
  it('ne change rien quand chacun est assis sur une chaise disponible', () => {
    const seats = table(p('Marie'), null, p('Léa'));
    expect(fitSeats(seats, 4)).toEqual(seats);
  });
  it('regroupe sur les premières chaises si les places ont été réduites', () => {
    expect(fitSeats(table(p('Marie'), null, null, null, p('Léa')), 2)).toEqual(table(p('Marie'), p('Léa')));
  });
  it('garde les premières personnes quand il y en a plus que de places', () => {
    expect(fitSeats(table(p('Marie'), p('Léa'), p('Noah')), 2)).toEqual(table(p('Marie'), p('Léa')));
  });
});
