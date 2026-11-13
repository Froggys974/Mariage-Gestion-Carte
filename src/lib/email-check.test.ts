import { describe, expect, it } from 'vitest';
import { checkMailDomain, editDistance, suggestEmail, type DnsResolver } from './email-check';

const err = (code: string) => Object.assign(new Error(code), { code });

/** Résolveur DNS factice : MX, A et AAAA par domaine (absent = ENOTFOUND). */
function fakeDns(zone: Record<string, { mx?: string[]; a?: string[]; aaaa?: string[] } | 'slow' | 'down'>) {
  const lookup =
    <T>(pick: (z: { mx?: string[]; a?: string[]; aaaa?: string[] }) => T[] | undefined) =>
    async (d: string): Promise<T[]> => {
      const z = zone[d];
      if (z === undefined) throw err('ENOTFOUND');
      if (z === 'slow') return new Promise(() => undefined);
      if (z === 'down') throw err('ESERVFAIL');
      const v = pick(z);
      if (!v) throw err('ENODATA');
      return v;
    };
  const r: DnsResolver = {
    resolveMx: lookup((z) => z.mx?.map((exchange) => ({ exchange, priority: 10 }))),
    resolve4: lookup((z) => z.a),
    resolve6: lookup((z) => z.aaaa),
  };
  return r;
}

describe('fautes de frappe dans l’adresse', () => {
  it('propose le fournisseur courant le plus proche', () => {
    expect(suggestEmail('marie@gmial.com')).toBe('marie@gmail.com');
    expect(suggestEmail('marie@gmail.con')).toBe('marie@gmail.com');
    expect(suggestEmail('marie@hotmal.fr')).toBe('marie@hotmail.fr');
    expect(suggestEmail('marie@wanado.fr')).toBe('marie@wanadoo.fr');
    expect(suggestEmail('marie@gmail.fr')).toBe('marie@gmail.com');
  });
  it('ne touche pas aux adresses correctes ni aux domaines éloignés', () => {
    expect(suggestEmail('marie@gmail.com')).toBeNull();
    expect(suggestEmail('marie@free.fr')).toBeNull();
    expect(suggestEmail('marie@sfr.fr')).toBeNull();
    expect(suggestEmail('marie@mail.com')).toBeNull();
    expect(suggestEmail('marie@mairie-saintpierre.fr')).toBeNull();
    expect(suggestEmail('marie@zeop.re')).toBeNull();
    expect(suggestEmail('marie@orange.re')).toBeNull();
  });
  it('compte une inversion de deux lettres comme une seule faute', () => {
    expect(editDistance('gmial', 'gmail')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
  });
});

describe('domaine de l’adresse (DNS)', () => {
  it('accepte un domaine avec MX, ou sans MX mais avec une adresse', async () => {
    const dns = fakeDns({ 'exemple.re': { mx: ['mx.exemple.re'] }, 'petit.fr': { a: ['1.2.3.4'] } });
    expect(await checkMailDomain('a@exemple.re', dns)).toBe('ok');
    expect(await checkMailDomain('a@petit.fr', dns)).toBe('ok');
  });
  it('signale un domaine inexistant ou qui refuse les emails (null MX)', async () => {
    const dns = fakeDns({ 'nul.fr': { mx: ['.'] }, 'vide.fr': {} });
    expect(await checkMailDomain('a@introuvable.fr', dns)).toBe('no_mail');
    expect(await checkMailDomain('a@nul.fr', dns)).toBe('no_mail');
    expect(await checkMailDomain('a@vide.fr', dns)).toBe('no_mail');
  });
  it('ne bloque jamais sur un doute : DNS en panne ou trop lent', async () => {
    const dns = fakeDns({ 'panne.fr': 'down', 'lent.fr': 'slow' });
    expect(await checkMailDomain('a@panne.fr', dns)).toBe('unknown');
    expect(await checkMailDomain('a@lent.fr', dns, 20)).toBe('unknown');
  });
  it('n’interroge pas les domaines réservés aux tests', async () => {
    const dns = fakeDns({});
    expect(await checkMailDomain('a@e2e.test', dns)).toBe('ok');
    expect(await checkMailDomain('a@example.com', dns)).toBe('ok');
  });
});
