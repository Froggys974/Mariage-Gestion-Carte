import { describe, expect, it } from 'vitest';
import { DEMO_WEDDING } from '../wedding/demo';
import { weddingLabels } from '../wedding/wedding';
import { moveItem, PROGRAMME } from './programme';
import { programmeBody, programmeOf } from './programme.service';

const item = { time: '15h00', title: 'Cérémonie', place: 'Église Saint-Pierre', note: '' };

describe('programme', () => {
  it('propose cérémonie puis réception à partir des infos du mariage', () => {
    const w = weddingLabels(DEMO_WEDDING);
    const proposed = [
      { time: '15h00', title: 'Cérémonie', place: 'Église Saint-Pierre, Saint-Pierre', note: '' },
      { time: '18h00', title: 'Réception', place: 'Domaine des Lilas', note: '' },
    ];
    expect(programmeOf({ programme: null }, w)).toEqual(proposed);
    expect(programmeOf({ programme: [] }, w)).toEqual(proposed);
    expect(programmeOf({ programme: [item] }, w)).toEqual([item]);
    // sans heure de réception : la cérémonie seule ; site non configuré : rien
    expect(programmeOf({ programme: null }, weddingLabels({ ...DEMO_WEDDING, receptionTime: '' }))).toEqual([
      proposed[0],
    ]);
    expect(programmeOf({ programme: null }, null)).toEqual([]);
  });

  it('valide les moments : heure et titre obligatoires, lieu et précision facultatifs', () => {
    const ok = programmeBody.safeParse({ items: [{ time: ' 15h00 ', title: 'Cérémonie' }] });
    expect(ok.success && ok.data.items[0]).toEqual({
      time: '15h00',
      title: 'Cérémonie',
      place: '',
      note: '',
    });
    expect(programmeBody.safeParse({ items: [{ time: '', title: 'Cérémonie' }] }).success).toBe(false);
    expect(programmeBody.safeParse({ items: [{ time: '15h00', title: '  ' }] }).success).toBe(false);
    expect(programmeBody.safeParse({ items: [] }).success).toBe(false);
    const tooMany = Array.from({ length: PROGRAMME.MAX_ITEMS + 1 }, () => item);
    expect(programmeBody.safeParse({ items: tooMany }).success).toBe(false);
    const long = { ...item, note: 'x'.repeat(PROGRAMME.NOTE_MAX + 1) };
    expect(programmeBody.safeParse({ items: [long] }).success).toBe(false);
  });

  it('monte et descend un moment sans sortir de la liste', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
