/**
 * Numéros de téléphone au format international E.164 (+262692112233).
 * Formats nationaux acceptés : La Réunion / Mayotte (+262) et France métropolitaine (+33).
 */

const E164_RE = /^\+[1-9]\d{7,14}$/;

/** Indicatifs après le 0 national qui relèvent du +262 (Réunion : 262, 263, 692, 693 ; Mayotte : 269, 639). */
const PREFIXES_262 = ['262', '263', '269', '639', '692', '693'];

export function isE164(value: string): boolean {
  return E164_RE.test(value);
}

/** Mobile réunionnais (+262 692 / 693). */
export function isReunionMobile(e164: string): boolean {
  return /^\+26269[23]\d{6}$/.test(e164);
}

/**
 * Normalise une saisie libre (« 0692 11 22 33 », « +262 692-11-22-33 », « 00262… ») en E.164.
 * Renvoie null si le numéro n'est pas reconnaissable.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/[^\d+\s.\-()/]/.test(raw)) return null;
  let digits = raw.replace(/[\s.\-()/]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+')) {
    // « +262 0692… » : on retire le 0 national saisi par erreur après l'indicatif
    digits = digits.replace(/^\+(262|33)0/, '+$1');
    return isE164(digits) ? digits : null;
  }
  if (/^0\d{9}$/.test(digits)) {
    const national = digits.slice(1);
    const cc = PREFIXES_262.includes(national.slice(0, 3)) ? '262' : '33';
    return `+${cc}${national}`;
  }
  // Mobile réunionnais saisi sans le 0 (692112233)
  if (/^69[23]\d{6}$/.test(digits)) return `+262${digits}`;
  return null;
}

/** Affichage lisible, au format national : 0692 11 22 33 (Réunion), 06 12 34 56 78 (métropole). */
export function formatPhone(e164: string): string {
  const m262 = /^\+262(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  if (m262) return `0${m262[1]} ${m262[2]} ${m262[3]} ${m262[4]}`;
  const m33 = /^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  if (m33) return `0${m33[1]} ${m33[2]} ${m33[3]} ${m33[4]} ${m33[5]}`;
  return e164;
}

/** Chiffres seuls, pour les liens wa.me. */
export function waNumber(e164: string): string {
  return e164.replace(/^\+/, '');
}
