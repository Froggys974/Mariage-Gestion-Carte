/**
 * Traduit l'erreur technique d'un envoi (SMTP, Brevo, API WhatsApp de Meta) en une cause compréhensible
 * pour les mariés. Aucun import Node ici (utilisé par l'îlot de l'admin).
 *
 * Codes WhatsApp : https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
import type { SendLog } from '~/lib/db/schema';

export type FailureReason =
  | 'no_contact'
  | 'email_unknown'
  | 'email_domain'
  | 'email_full'
  | 'email_blocked'
  | 'wa_not_whatsapp'
  | 'wa_test'
  | 'wa_limit'
  | 'wa_payment'
  | 'config'
  | 'other';

const has = (re: RegExp, s: string) => re.test(s);

export function classifySendError(
  channel: SendLog['channel'],
  error: string | null | undefined,
): FailureReason {
  const e = (error ?? '').toLowerCase();
  if (has(/pas d.email|pas de t[ée]l[ée]phone|no_contact/, e)) return 'no_contact';
  if (channel === 'whatsapp') {
    if (has(/\b131026\b/, e)) return 'wa_not_whatsapp';
    if (has(/\b131030\b/, e)) return 'wa_test';
    if (has(/\b(130429|131048|131049|131056)\b/, e)) return 'wa_limit';
    if (has(/\b131042\b/, e)) return 'wa_payment';
    if (has(/whatsapp 40[13]\b|\b(190|131005|132000|132001|132012)\b/, e)) return 'config';
    return 'other';
  }
  if (has(/quota|mailbox (is )?full|5\.2\.2|\b552\b/, e)) return 'email_full';
  if (has(/5\.1\.2|5\.4\.4|domain not found|host not found|no mx/, e)) return 'email_domain';
  if (
    has(
      /hard_bounce|invalid_email|5\.1\.[01]|user unknown|unknown user|no such user|does not exist|mailbox unavailable|recipient.*(rejected|refused|invalid)|\b55[03]\b/,
      e,
    )
  ) {
    return 'email_unknown';
  }
  if (has(/blocked|spam|5\.7\.\d/, e)) return 'email_blocked';
  if (
    has(
      /eauth|\b535\b|econnection|econnrefused|etimedout|esocket|getaddrinfo|enotfound|certificate|greeting/,
      e,
    )
  ) {
    return 'config';
  }
  return 'other';
}
