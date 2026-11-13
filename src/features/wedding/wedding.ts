/**
 * Informations du mariage (table `wedding`, saisies dans l'assistant d'installation puis l'onglet « Mariage »)
 * et libellés qui en découlent : noms, monogramme, dates, lieu, itinéraire…
 * Aucun import Node ici : utilisé côté serveur, dans les îlots de l'admin et dans les gabarits d'envoi.
 */

/** Ce que les mariés saisissent (sans les champs techniques de la base). */
export interface WeddingInfo {
  partner1First: string;
  partner1Last: string;
  partner2First: string;
  partner2Last: string;
  /** AAAA-MM-JJ */
  weddingDate: string;
  /** HH:MM */
  ceremonyTime: string;
  /** HH:MM, ou '' */
  receptionTime: string;
  venueName: string;
  venueCity: string;
  /** ex. « La Réunion », ou '' */
  venueRegion: string;
  /** lieu de la réception s'il diffère, ou '' */
  receptionPlace: string;
  contactEmail: string;
  /** E.164 (+262692…), ou '' */
  contactPhone: string;
  /** ex. « Témoins » */
  contactPhoneLabel: string;
  privacyEmail: string;
}

export const WEDDING_LIMITS = {
  FIRST: 40,
  LAST: 60,
  VENUE: 80,
  CITY: 60,
  REGION: 60,
  RECEPTION_PLACE: 120,
  PHONE_LABEL: 40,
  EMAIL: 200,
} as const;

const NB_HYPHEN = String.fromCharCode(0x2011);
const NBSP = String.fromCharCode(0xa0);

/** Prénom affiché sans coupure de ligne au milieu (« Marie‑Ange », « Jean Luc »). */
export function unbreakable(name: string): string {
  return name.trim().replace(/-/g, NB_HYPHEN).replace(/\s+/g, NBSP);
}

/** « Marie-Ange » → « M‑A » ; « Jean Luc » → « J‑L » ; « Marie » → « M ». */
export function initials(name: string): string {
  return name
    .trim()
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toLocaleUpperCase('fr-FR'))
    .join(NB_HYPHEN);
}

/** « 15:00 » → « 15h00 » */
export function formatHour(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? `${m[1]!.padStart(2, '0')}h${m[2]}` : hhmm.trim();
}

/** Une date AAAA-MM-JJ, à midi UTC : aucun décalage de jour quel que soit le fuseau. */
function dateOf(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: 'UTC' });
const LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const SHORT = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const first1er = (s: string) => s.replace(/(^|\s)1 /, (_m, sp: string) => `${sp}1er `);
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1);

/** Libellés dérivés, utilisés par les textes de src/content/fr.ts. */
export interface WeddingLabels {
  /** « Marie‑Ange » */
  name1: string;
  /** « Jean Luc » (insécable) */
  name2: string;
  /** « Marie‑Ange & Jean Luc » */
  couple: string;
  /** « Marie-Ange & Jean Luc » (texte brut : emails texte, WhatsApp, noms de fichiers) */
  couplePlain: string;
  /** « Marie-Ange Payet et Jean Luc Técher » */
  fullNames: string;
  monogram: { left: string; right: string };
  /** « Samedi 19 décembre 2026 » */
  dateLong: string;
  /** « samedi 19 décembre 2026 » (au milieu d'une phrase) */
  dateInline: string;
  /** « 19 décembre 2026 » */
  dateShort: string;
  /** « 19 · 12 · 2026 » */
  dateDots: string;
  /** « 15h00 » */
  ceremony: string;
  /** « 16h00 », ou '' */
  reception: string;
  venueName: string;
  venueCity: string;
  venueRegion: string;
  /** « Saint-Pierre · La Réunion » */
  cityLine: string;
  /** « Église Saint‑Pierre, Saint‑Pierre » */
  venueWithCity: string;
  /** recherche de l'itinéraire (Google Maps) */
  mapsUrl: string;
  receptionPlace: string;
  contactEmail: string;
  contactPhone: string;
  contactPhoneLabel: string;
  privacyEmail: string;
  /** « Faire-part-Marie-Ange-Jean-Luc.png » */
  cardFileName: string;
}

/** « Marie-Ange & Jean Luc » → « Marie-Ange-Jean-Luc » (sans accents ni espaces). */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function weddingLabels(w: WeddingInfo): WeddingLabels {
  const d = dateOf(w.weddingDate);
  const [y, m, day] = w.weddingDate.split('-');
  const long = first1er(LONG.format(d));
  const p1 = w.partner1First.trim();
  const p2 = w.partner2First.trim();
  const city = w.venueCity.trim();
  const region = w.venueRegion.trim();
  return {
    name1: unbreakable(p1),
    name2: unbreakable(p2),
    couple: `${unbreakable(p1)} & ${unbreakable(p2)}`,
    couplePlain: `${p1} & ${p2}`,
    fullNames: `${p1} ${w.partner1Last.trim()} et ${p2} ${w.partner2Last.trim()}`,
    monogram: { left: initials(p1), right: initials(p2) },
    dateLong: capitalize(long),
    dateInline: long,
    dateShort: first1er(SHORT.format(d)),
    dateDots: `${day} · ${m} · ${y}`,
    ceremony: formatHour(w.ceremonyTime),
    reception: w.receptionTime ? formatHour(w.receptionTime) : '',
    venueName: w.venueName.trim(),
    venueCity: city,
    venueRegion: region,
    cityLine: [city, region].filter(Boolean).join(' · '),
    venueWithCity: `${w.venueName.trim()}, ${city}`,
    mapsUrl: `https://maps.google.com/?q=${encodeURIComponent([w.venueName, city, region].filter(Boolean).join(' '))}`,
    receptionPlace: w.receptionPlace.trim(),
    contactEmail: w.contactEmail.trim(),
    contactPhone: w.contactPhone.trim(),
    contactPhoneLabel: w.contactPhoneLabel.trim(),
    privacyEmail: w.privacyEmail.trim(),
    cardFileName: `Faire-part-${slug(`${p1} ${p2}`)}.png`,
  };
}

/** Date du mariage + n mois, au format AAAA-MM-JJ (jour ramené à la fin du mois si besoin). */
export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Date du mariage − n jours, au format AAAA-MM-JJ. */
export function addDays(ymd: string, n: number): string {
  const t = dateOf(ymd);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Proposition de date limite des réponses : 18 jours avant (comme le 1er décembre pour un 19 décembre). */
export const DEFAULT_DEADLINE_DAYS_BEFORE = 18;
/** Effacement des allergies et coordonnées : 3 mois après le mariage. */
export const PURGE_MONTHS_AFTER = 3;
