/**
 * Récapitulatif affiché après « Enregistrer » dans l'onglet « Mariage » :
 * la liste des champs modifiés, avec l'ancienne et la nouvelle valeur, lisibles (dates, heures, téléphones).
 */
import { admin } from '~/content/fr';
import { formatLongDate, fromDateInput } from '~/lib/dates';
import { formatPhone } from '~/lib/phone';
import { formatHour, type WeddingInfo } from './wedding';

const t = admin.wedding;

/** Le libellé du formulaire, sans la mention « (facultatif) ». */
const short = (label: string) => label.replace(/\s*\(facultatif\)\s*$/, '');

/** Champs dans l'ordre du formulaire, avec leur libellé. */
const FIELDS: Array<[keyof WeddingInfo, string]> = [
  ['partner1First', `${t.partner(1)} · ${t.first}`],
  ['partner1Last', `${t.partner(1)} · ${t.last}`],
  ['partner2First', `${t.partner(2)} · ${t.first}`],
  ['partner2Last', `${t.partner(2)} · ${t.last}`],
  ['weddingDate', t.date],
  ['ceremonyTime', t.ceremonyTime],
  ['receptionTime', short(t.receptionTime)],
  ['venueName', t.venueName],
  ['venueCity', t.venueCity],
  ['venueRegion', short(t.venueRegion)],
  ['receptionPlace', short(t.receptionPlace)],
  ['contactEmail', t.contactEmail],
  ['contactPhone', short(t.contactPhone)],
  ['contactPhoneLabel', short(t.contactPhoneLabel)],
  ['contactPhone2', short(t.contactPhone2)],
  ['contactPhone2Label', t.contactPhone2Label],
  ['privacyEmail', t.privacyEmail],
];

/** Valeur telle qu'on la montre aux mariés (et telle qu'on la compare). */
function display(field: keyof WeddingInfo, raw: string | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  if (field === 'weddingDate' && /^\d{4}-\d{2}-\d{2}$/.test(v))
    return formatLongDate(fromDateInput(v, false));
  if (field === 'ceremonyTime' || field === 'receptionTime') return formatHour(v);
  if (field === 'contactPhone' || field === 'contactPhone2') return formatPhone(v);
  if (field === 'contactEmail' || field === 'privacyEmail') return v.toLowerCase();
  return v;
}

export interface WeddingChange {
  label: string;
  before: string;
  after: string;
}

/** Champs modifiés entre deux versions des infos du mariage ; une valeur vide s'affiche « (vide) ». */
export function weddingChanges(before: WeddingInfo, after: WeddingInfo): WeddingChange[] {
  const changes: WeddingChange[] = [];
  for (const [field, label] of FIELDS) {
    const a = display(field, before[field]);
    const b = display(field, after[field]);
    if (a !== b) changes.push({ label, before: a || t.emptyValue, after: b || t.emptyValue });
  }
  return changes;
}

/** Les infos telles que le formulaire les affiche (téléphones au format 0692 11 22 33). */
export function formValues(w: WeddingInfo): WeddingInfo {
  return {
    ...w,
    contactPhone: w.contactPhone ? formatPhone(w.contactPhone) : '',
    contactPhone2: w.contactPhone2 ? formatPhone(w.contactPhone2) : '',
  };
}
