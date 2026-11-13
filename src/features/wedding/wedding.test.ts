import { describe, expect, it } from 'vitest';
import { DEMO_WEDDING } from './demo';
import { addDays, addMonths, formatHour, initials, weddingLabels } from './wedding';
import { setupInput, weddingInput } from './wedding.service';

const NBH = String.fromCharCode(0x2011);
const NBSP = String.fromCharCode(0xa0);

describe('libellés du mariage', () => {
  it('noms, monogramme, dates et lieu à partir des infos saisies', () => {
    const w = weddingLabels(DEMO_WEDDING);
    expect(w.couple).toBe('Camille & Alex');
    expect(w.couplePlain).toBe('Camille & Alex');
    expect(w.fullNames).toBe('Camille Martin et Alex Hoarau');
    expect(w.monogram).toEqual({ left: 'C', right: 'A' });
    expect(w.dateLong).toBe('Samedi 12 juin 2027');
    expect(w.dateInline).toBe('samedi 12 juin 2027');
    expect(w.dateShort).toBe('12 juin 2027');
    expect(w.dateDots).toBe('12 · 06 · 2027');
    expect(w.ceremony).toBe('15h00');
    expect(w.reception).toBe('18h00');
    expect(w.cityLine).toBe('Saint-Pierre · La Réunion');
    expect(w.venueWithCity).toBe('Église Saint-Pierre, Saint-Pierre');
    expect(w.mapsUrl).toBe(
      'https://maps.google.com/?q=%C3%89glise%20Saint-Pierre%20Saint-Pierre%20La%20R%C3%A9union',
    );
    expect(w.cardFileName).toBe('Faire-part-Camille-Alex.png');
  });
  it('prénoms composés : insécables à l’affichage, initiales séparées', () => {
    const w = weddingLabels({ ...DEMO_WEDDING, partner1First: 'Marie-Ange', partner2First: 'Jean Luc' });
    expect(w.name1).toBe(`Marie${NBH}Ange`);
    expect(w.name2).toBe(`Jean${NBSP}Luc`);
    expect(w.monogram).toEqual({ left: `M${NBH}A`, right: `J${NBH}L` });
    expect(w.cardFileName).toBe('Faire-part-Marie-Ange-Jean-Luc.png');
    expect(initials('  marie ')).toBe('M');
  });
  it('« 1er » du mois, réception facultative, région facultative', () => {
    const w = weddingLabels({
      ...DEMO_WEDDING,
      weddingDate: '2027-05-01',
      receptionTime: '',
      venueRegion: '',
    });
    expect(w.dateLong).toBe('Samedi 1er mai 2027');
    expect(w.dateShort).toBe('1er mai 2027');
    expect(w.reception).toBe('');
    expect(w.cityLine).toBe('Saint-Pierre');
  });
  it('calculs de dates : effacement (+3 mois) et date limite proposée', () => {
    expect(addMonths('2026-12-19', 3)).toBe('2027-03-19');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addDays('2026-12-19', -18)).toBe('2026-12-01');
    expect(formatHour('9:05')).toBe('09h05');
  });
});

describe('saisie des infos du mariage', () => {
  it('accepte une saisie complète et normalise téléphone et emails', () => {
    const r = weddingInput.parse({
      ...DEMO_WEDDING,
      contactPhone: '0692 11 22 33',
      contactEmail: ' A@B.FR ',
    });
    expect(r.contactPhone).toBe('+262692112233');
    expect(r.contactEmail).toBe('a@b.fr');
  });
  it('refuse les champs obligatoires vides, les emails, heures et téléphones invalides', () => {
    const bad = (patch: Record<string, string>) =>
      weddingInput.safeParse({ ...DEMO_WEDDING, ...patch }).success;
    expect(bad({ partner1First: ' ' })).toBe(false);
    expect(bad({ venueCity: '' })).toBe(false);
    expect(bad({ contactEmail: 'pas-un-email' })).toBe(false);
    expect(bad({ privacyEmail: '' })).toBe(false);
    expect(bad({ ceremonyTime: '25:00' })).toBe(false);
    expect(bad({ receptionTime: '18h' })).toBe(false);
    expect(bad({ contactPhone: '12' })).toBe(false);
    expect(bad({ weddingDate: '19/12/2026' })).toBe(false);
    expect(bad({ receptionTime: '', contactPhone: '', venueRegion: '' })).toBe(true);
  });
  it('l’installation demande en plus la date limite des réponses', () => {
    const { rsvpDeadline: _omit, ...withoutDeadline } = DEMO_WEDDING;
    expect(setupInput.safeParse(withoutDeadline).success).toBe(false);
    expect(setupInput.safeParse(DEMO_WEDDING).success).toBe(true);
  });
});
