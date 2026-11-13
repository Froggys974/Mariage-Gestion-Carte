/** Validation (Zod) des actions de l'espace admin. */
import { z } from 'zod';
import { normalizePhone } from '~/lib/phone';

const name = z.string().trim().min(1).max(80);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Téléphone saisi librement → E.164 (ou erreur « phone »). */
const phone = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const e164 = normalizePhone(v);
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'phone' });
      return z.NEVER;
    }
    return e164;
  });

const email = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const ok = z.email().safeParse(v);
    if (!ok.success) {
      ctx.addIssue({ code: 'custom', message: 'email' });
      return z.NEVER;
    }
    return v.toLowerCase();
  });

export const invitationInput = z
  .object({
    first: name,
    last: name,
    email,
    phone,
    displayName: optionalText(120),
    maxSeats: z.coerce.number().int().min(1).max(6).optional(),
    agreement: z.enum(['invite', 'invitee']).optional(),
    /** envoyer tout de suite (« Envoyer le faire-part ») */
    send: z.boolean().optional(),
    /** garder l'adresse malgré une faute de frappe probable (« Garder telle quelle ») */
    confirmEmail: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.email || v.phone), { message: 'contact', path: ['email'] });

export type InvitationInput = z.infer<typeof invitationInput>;

export const invitationPatch = z.object({
  first: name.optional(),
  last: name.optional(),
  email: z.union([email, z.literal(null)]).optional(),
  phone: z.union([phone, z.literal(null)]).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  maxSeats: z.coerce.number().int().min(1).max(6).optional(),
  agreement: z.enum(['invite', 'invitee']).optional(),
  confirmEmail: z.boolean().optional(),
  expectedUpdatedAt: z.iso.datetime(),
});

export const idList = z.object({ ids: z.array(z.uuid()).min(1).max(1000) });

export const importBody = z.object({
  csv: z.string().min(1).max(2_000_000),
  dryRun: z.boolean().default(true),
});

export const sendBody = z.object({ channel: z.enum(['email', 'whatsapp', 'lien', 'wa_me']) });
export const bulkSendBody = z.object({
  ids: z.array(z.uuid()).min(1).max(1000),
  channel: z.enum(['email', 'whatsapp']),
});

/** Erreur de champ lisible pour l'interface. */
export function fieldError(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  const msgs = issues.map((i) => i.message);
  if (msgs.includes('phone')) return 'phone';
  if (msgs.includes('email')) return 'email';
  return 'missing';
}
