/** Formats de date en français, à l'heure de La Réunion. */
export const TIME_ZONE = 'Indian/Reunion';

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: TIME_ZONE });
const longDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
});
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: TIME_ZONE });
const hourMinute = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
const dateTime = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

/** « 1er décembre », « 19 mars » */
export function formatDayMonth(d: Date): string {
  return dayMonth.format(d).replace(/^1 /, '1er ');
}
/** « 19 mars 2027 », « 1er décembre 2026 » */
export function formatLongDate(d: Date): string {
  return longDate.format(d).replace(/^1 /, '1er ');
}
/** « 2 sept. » */
export function formatShortDate(d: Date): string {
  return shortDate.format(d);
}
/** « 14:05 » */
export function formatTime(d: Date): string {
  return hourMinute.format(d);
}
/** « 2 sept., 14:05 » */
export function formatDateTime(d: Date): string {
  return dateTime.format(d);
}
/** Valeur pour <input type="date"> (AAAA-MM-JJ) à l'heure de La Réunion. */
export function toDateInput(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d);
}
/** Lit un AAAA-MM-JJ comme « fin de journée » ou « début de journée » à La Réunion (UTC+4, sans heure d'été). */
export function fromDateInput(value: string, endOfDay: boolean): Date {
  return new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}+04:00`);
}
