/** Contrôle d'une adresse email saisie par les mariés (faute de frappe, domaine sans email). */
import { checkMailDomain, suggestEmail, type DomainStatus } from '~/lib/email-check';
import { problem } from '~/lib/http';

export type EmailVerdict =
  | { ok: true }
  | { ok: false; code: 'email_typo'; suggestion: string }
  | { ok: false; code: 'email_domain'; domain: string };

export async function verifyEmail(
  email: string,
  { allowTypo = false, checkDomain = checkMailDomain } = {} as {
    allowTypo?: boolean;
    checkDomain?: (email: string) => Promise<DomainStatus>;
  },
): Promise<EmailVerdict> {
  if (!allowTypo) {
    const suggestion = suggestEmail(email);
    if (suggestion) return { ok: false, code: 'email_typo', suggestion };
  }
  if ((await checkDomain(email)) === 'no_mail') {
    return { ok: false, code: 'email_domain', domain: email.slice(email.lastIndexOf('@') + 1) };
  }
  return { ok: true };
}

/** Réponse 400 si l'adresse est douteuse, sinon null. */
export async function emailProblem(
  email: string | null | undefined,
  allowTypo = false,
): Promise<Response | null> {
  if (!email) return null;
  const v = await verifyEmail(email, { allowTypo });
  if (v.ok) return null;
  return v.code === 'email_typo'
    ? problem(400, v.code, { suggestion: v.suggestion })
    : problem(400, v.code, { domain: v.domain });
}
