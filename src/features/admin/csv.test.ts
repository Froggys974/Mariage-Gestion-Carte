import { describe, expect, it } from 'vitest';
import { invitationInput } from './admin.schema';
import { detectDelimiter, parseCsv, rowsToRecords, safeCell, toCsv } from './csv';

describe('lecture CSV', () => {
  it('détecte « ; » (Excel français) et « , »', () => {
    expect(detectDelimiter('prenom;nom;email')).toBe(';');
    expect(detectDelimiter('prenom,nom,email')).toBe(',');
  });
  it('gère BOM, guillemets, guillemets doublés et retours Windows', () => {
    const rows = parseCsv('\ufeffprenom;nom\r\n"Marie-Ange";"Payet ""Mamie"""\r\nJoël;Técher\r\n');
    expect(rows).toEqual([
      ['prenom', 'nom'],
      ['Marie-Ange', 'Payet "Mamie"'],
      ['Joël', 'Técher'],
    ]);
  });
  it('accepte un point-virgule dans une cellule entre guillemets', () => {
    expect(parseCsv('a;b\n"x;y";z')[1]).toEqual(['x;y', 'z']);
  });
  it('reconnaît les en-têtes avec accents et synonymes', () => {
    const recs = rowsToRecords(
      parseCsv('Prénom;Nom;Téléphone;Famille\nFabienne;Lebon;0693 44 55 66;Famille Lebon'),
    );
    expect(recs[0]).toEqual({
      line: 2,
      data: { first: 'Fabienne', last: 'Lebon', phone: '0693 44 55 66', displayName: 'Famille Lebon' },
    });
  });
  it('valide chaque ligne : téléphone converti en E.164, un contact obligatoire', () => {
    const ok = invitationInput.safeParse({ first: 'Fabienne', last: 'Lebon', phone: '0693 44 55 66' });
    expect(ok.success && ok.data.phone).toBe('+262693445566');
    expect(invitationInput.safeParse({ first: 'A', last: 'B' }).success).toBe(false);
    expect(invitationInput.safeParse({ first: 'A', last: 'B', phone: '12' }).success).toBe(false);
  });
});

describe('écriture CSV', () => {
  it('écrit « ; » + BOM, échappe les guillemets', () => {
    const csv = toCsv(['nom', 'note'], [['Payet', 'dit "Mamie"; sans porc']]);
    expect(csv.startsWith('\ufeffnom;note\r\n')).toBe(true);
    expect(csv).toContain('Payet;"dit ""Mamie""; sans porc"');
  });
  it('neutralise les formules mais garde les numéros +262', () => {
    expect(safeCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(safeCell('+262692112233')).toBe('+262692112233');
    expect(safeCell('@SUM')).toBe("'@SUM");
  });
});
