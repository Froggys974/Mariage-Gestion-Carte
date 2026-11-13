/** Validation (Zod) des réponses envoyées par le site invité. */
import { z } from 'zod';
import { SEAT_COUNT } from '../invitation/boot';

export const NAME_MAX = 80;
export const NOTE_MAX = 300;

/** Supprime les caractères de contrôle et réduit les espaces. */
const clean = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((s) =>
      s
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max),
    );

export const seatSchema = z
  .object({
    id: z.uuid().optional(),
    first: clean(NAME_MAX),
    last: clean(NAME_MAX),
    note: clean(NOTE_MAX).default(''),
  })
  .refine((s) => s.first !== '' || s.last !== '', { message: 'prénom ou nom requis' });

export const seatsSchema = z
  .array(seatSchema.nullable())
  .length(SEAT_COUNT)
  .refine((a) => a[0] !== null, { message: "la chaise de l'invité principal est obligatoire" });

export const draftBody = z.object({ seats: seatsSchema });
export const submitBody = z.object({ seats: seatsSchema, expectedUpdatedAt: z.iso.datetime().nullish() });
export const declineBody = z.object({ expectedUpdatedAt: z.iso.datetime().nullish() });

export type SeatsInput = z.infer<typeof seatsSchema>;
