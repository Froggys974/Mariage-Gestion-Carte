import { describe, expect, it } from 'vitest';
import { applyPlan, planGuestReplacement, type IncomingSeat } from './replace';

const seat = (first: string, id?: string, note = ''): IncomingSeat => ({ id, first, last: 'Payet', note });
const existing = [
  { id: 'g0', position: 0, firstName: 'Marie-Ange' },
  { id: 'g1', position: 1, firstName: 'Jean-Luc' },
  { id: 'g2', position: 2, firstName: 'Léa' },
];

describe('remplacement de la réponse sans doublon', () => {
  it('renvoyer la même réponse ne crée aucune ligne', () => {
    const plan = planGuestReplacement(existing, [
      seat('Marie-Ange', 'g0'),
      seat('Jean-Luc', 'g1'),
      seat('Léa', 'g2'),
    ]);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
    expect(plan.updates.map((u) => u.id)).toEqual(['g0', 'g1', 'g2']);
  });

  it('le résultat contient exactement une ligne par chaise occupée', () => {
    const incoming = [seat('Marie-Ange', 'g0'), null, seat('Léa', 'g2'), seat('Noah')];
    const result = applyPlan(existing, planGuestReplacement(existing, incoming));
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.firstName)).toEqual(['Marie-Ange', 'Léa', 'Noah']);
    expect(new Set(result.map((r) => r.position)).size).toBe(3);
  });

  it('retire les personnes absentes de la nouvelle réponse', () => {
    const plan = planGuestReplacement(existing, [seat('Marie-Ange', 'g0')]);
    expect(plan.deletes.sort()).toEqual(['g1', 'g2']);
  });

  it('garde l’id d’une personne modifiée (sa chaise du plan de table est conservée)', () => {
    const plan = planGuestReplacement(existing, [
      seat('Marie-Ange', 'g0'),
      seat('Jean-Luc', 'g1', 'Sans gluten'),
    ]);
    expect(plan.updates.find((u) => u.id === 'g1')?.notes).toBe('Sans gluten');
  });

  it('ignore un id inconnu ou répété : jamais deux lignes pour un même id', () => {
    const plan = planGuestReplacement(existing, [
      seat('Marie-Ange', 'g0'),
      seat('Copie', 'g0'),
      seat('Pirate', 'zzz'),
    ]);
    expect(plan.updates.map((u) => u.id)).toEqual(['g0']);
    expect(plan.inserts).toHaveLength(2);
    const result = applyPlan(existing, plan);
    expect(new Set(result.map((r) => r.id)).size).toBe(result.length);
  });

  it('marque la chaise 0 comme invité principal et nettoie les notes vides', () => {
    const plan = planGuestReplacement(
      [],
      [seat('A', undefined, '   '), seat('B', undefined, ' Végétarien ')],
    );
    expect(plan.inserts[0]).toMatchObject({ isPrimary: true, notes: null, position: 0 });
    expect(plan.inserts[1]).toMatchObject({ isPrimary: false, notes: 'Végétarien' });
  });

  it('envois répétés (modifier puis renvoyer) : le nombre de lignes reste celui des chaises', () => {
    let rows = existing.map((g) => ({ ...g }));
    for (let n = 0; n < 5; n++) {
      const incoming = rows.map((r) => seat(r.firstName ?? '', r.id));
      const result = applyPlan(rows, planGuestReplacement(rows, incoming));
      rows = result.map((r, k) => ({ ...r, id: r.id.startsWith('new') ? `g${10 + n * 10 + k}` : r.id }));
    }
    expect(rows).toHaveLength(3);
  });
});
