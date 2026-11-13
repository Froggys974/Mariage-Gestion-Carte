/**
 * Schéma de la base (Drizzle). Justification des choix : doc/adr/0003-modele-de-donnees.md
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Horodatage en millisecondes : égalité exacte possible avec un Date JS (contrôle de version). */
const ts = (name: string) => timestamp(name, { withTimezone: true, precision: 3, mode: 'date' });

export const invitationStatus = pgEnum('invitation_status', [
  'not_sent',
  'sent',
  'opened',
  'started',
  'submitted',
  'declined',
]);
export const invitationKind = pgEnum('invitation_kind', ['guest', 'couple']);
export const hostAgreement = pgEnum('host_agreement', ['invite', 'invitee']);
export const sendChannel = pgEnum('send_channel', ['email', 'whatsapp', 'lien']);
export const sendPurpose = pgEnum('send_purpose', ['invitation', 'relance', 'lien_perdu', 'code', 'carte']);
export const sendStatus = pgEnum('send_status', ['queued', 'sent', 'delivered', 'read', 'failed']);
export const tableShape = pgEnum('table_shape', ['round', 'rect']);

export type InvitationStatus = (typeof invitationStatus.enumValues)[number];
export type SendChannel = (typeof sendChannel.enumValues)[number];
export type SendPurpose = (typeof sendPurpose.enumValues)[number];
export type SendStatus = (typeof sendStatus.enumValues)[number];
export type TableShape = (typeof tableShape.enumValues)[number];
export type HostAgreement = (typeof hostAgreement.enumValues)[number];

/** Une chaise du brouillon (côté invité), avant envoi. */
export interface DraftSeat {
  /** id du guest déjà enregistré, s'il existe (permet un remplacement sans perdre le plan de table) */
  id?: string;
  first: string;
  last: string;
  note: string;
}
/** Brouillon : une entrée par chaise (index = position), null = chaise libre. */
export type Draft = Array<DraftSeat | null>;

/** Un moment du programme de la journée (onglet « Programme » de l'admin). */
export interface ProgrammeItem {
  time: string;
  title: string;
  place: string;
  note: string;
}

export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull(),
    kind: invitationKind('kind').notNull().default('guest'),
    displayName: text('display_name').notNull(),
    contactFirstName: text('contact_first_name').notNull(),
    contactLastName: text('contact_last_name').notNull(),
    email: text('email'),
    phoneE164: text('phone_e164'),
    hostAgreement: hostAgreement('host_agreement').notNull().default('invite'),
    maxSeats: smallint('max_seats').notNull().default(6),
    status: invitationStatus('status').notNull().default('not_sent'),
    draft: jsonb('draft').$type<Draft>(),
    draftUpdatedAt: ts('draft_updated_at'),
    firstSentAt: ts('first_sent_at'),
    openedAt: ts('opened_at'),
    respondedAt: ts('responded_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invitation_token_uq').on(t.token),
    index('invitation_email_idx').on(sql`lower(${t.email})`),
    index('invitation_phone_idx').on(t.phoneE164),
    index('invitation_contact_trgm').using(
      'gin',
      sql`f_unaccent(lower(${t.contactFirstName} || ' ' || ${t.contactLastName})) gin_trgm_ops`,
    ),
    check('invitation_max_seats_ck', sql`${t.maxSeats} between 1 and 6`),
    check('invitation_token_ck', sql`${t.token} ~ '^[A-Za-z0-9_-]{22}$'`),
  ],
);

export const guest = pgTable(
  'guest',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitation.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    /** Allergies / remarques : donnée de santé, effacée automatiquement (site_settings.purge_at). */
    notes: text('notes'),
    isPrimary: boolean('is_primary').notNull().default(false),
    position: smallint('position').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('guest_invitation_position_uq').on(t.invitationId, t.position),
    index('guest_invitation_idx').on(t.invitationId),
    index('guest_name_trgm').using(
      'gin',
      sql`f_unaccent(lower(${t.firstName} || ' ' || ${t.lastName})) gin_trgm_ops`,
    ),
    check('guest_position_ck', sql`${t.position} >= 0`),
  ],
);

export const sendLog = pgTable(
  'send_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitation.id, { onDelete: 'cascade' }),
    channel: sendChannel('channel').notNull(),
    purpose: sendPurpose('purpose').notNull(),
    status: sendStatus('status').notNull().default('queued'),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    sentAt: ts('sent_at'),
    deliveredAt: ts('delivered_at'),
    readAt: ts('read_at'),
  },
  (t) => [
    index('send_log_invitation_idx').on(t.invitationId, t.createdAt),
    index('send_log_provider_idx').on(t.providerMessageId),
  ],
);

/** Charge utile d'un envoi en attente. Le code OTP n'y reste que jusqu'à l'envoi. */
export interface JobPayload {
  code?: string;
  /** envoi de la carte : adresse saisie par l'invité (effacée avec l'envoi) */
  to?: string;
  /** envoi de la carte : image PNG en attente dans le stockage (supprimée après l'envoi) */
  cardKey?: string;
}

export const messageJob = pgTable(
  'message_job',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sendLogId: uuid('send_log_id')
      .notNull()
      .references(() => sendLog.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<JobPayload>().notNull().default({}),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: ts('next_attempt_at').notNull().defaultNow(),
    lockedAt: ts('locked_at'),
    lastError: text('last_error'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('message_job_send_log_uq').on(t.sendLogId),
    index('message_job_due_idx').on(t.nextAttemptAt),
  ],
);

export const cardSettings = pgTable(
  'card_settings',
  {
    id: smallint('id').primaryKey().default(1),
    names: text('names').notNull(),
    dateLabel: text('date_label').notNull(),
    place: text('place').notNull(),
    ceremonyTime: text('ceremony_time').notNull(),
    receptionTime: text('reception_time').notNull(),
    message: text('message').notNull(),
    /** Clé de stockage de base de la photo (variantes -400.webp, -800.avif, …) */
    photoKey: text('photo_key'),
    /** Image PNG des noms en Pinyon Script, pour les emails (les clients mail ignorent les polices web). */
    namesImageKey: text('names_image_key'),
    /** Cadrage de la photo (forme, point de cadrage, zoom) ; null = rectangle centré (src/features/card/photo-frame.ts) */
    photoFrame: jsonb('photo_frame').$type<{ shape: string; x: number; y: number; zoom: number }>(),
    /** Programme de la journée ; null = programme proposé à partir des infos du mariage */
    programme: jsonb('programme').$type<ProgrammeItem[]>(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [check('card_settings_singleton_ck', sql`${t.id} = 1`)],
);

/** Informations du mariage (ligne unique), saisies dans l'assistant d'installation. Absente = site non configuré. */
export const wedding = pgTable(
  'wedding',
  {
    id: smallint('id').primaryKey().default(1),
    partner1First: text('partner1_first').notNull(),
    partner1Last: text('partner1_last').notNull(),
    partner2First: text('partner2_first').notNull(),
    partner2Last: text('partner2_last').notNull(),
    weddingDate: date('wedding_date', { mode: 'string' }).notNull(),
    ceremonyTime: text('ceremony_time').notNull(),
    receptionTime: text('reception_time').notNull().default(''),
    venueName: text('venue_name').notNull(),
    venueCity: text('venue_city').notNull(),
    venueRegion: text('venue_region').notNull().default(''),
    receptionPlace: text('reception_place').notNull().default(''),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone').notNull().default(''),
    contactPhoneLabel: text('contact_phone_label').notNull().default(''),
    privacyEmail: text('privacy_email').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [check('wedding_singleton_ck', sql`${t.id} = 1`)],
);

export const siteSettings = pgTable(
  'site_settings',
  {
    id: smallint('id').primaryKey().default(1),
    rsvpDeadline: ts('rsvp_deadline').notNull(),
    publicRsvpEnabled: boolean('public_rsvp_enabled').notNull().default(false),
    purgeAt: ts('purge_at').notNull(),
    purgedAt: ts('purged_at'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [check('site_settings_singleton_ck', sql`${t.id} = 1`)],
);

export const seatingPlan = pgTable(
  'seating_plan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('seating_plan_one_active_uq')
      .on(t.isActive)
      .where(sql`${t.isActive}`),
  ],
);

export const seatingTable = pgTable(
  'seating_table',
  {
    id: uuid('id').primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => seatingPlan.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    shape: tableShape('shape').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    seatCount: smallint('seat_count').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('seating_table_plan_idx').on(t.planId),
    check('seating_table_seats_ck', sql`${t.seatCount} between 2 and 16`),
  ],
);

export const seatingSeat = pgTable(
  'seating_seat',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => seatingPlan.id, { onDelete: 'cascade' }),
    tableId: uuid('table_id')
      .notNull()
      .references(() => seatingTable.id, { onDelete: 'cascade' }),
    seatIndex: smallint('seat_index').notNull(),
    /** null si la personne a été retirée de la réponse : le plan garde une trace (snapshot) pour alerter. */
    guestId: uuid('guest_id').references(() => guest.id, { onDelete: 'set null' }),
    guestNameSnapshot: text('guest_name_snapshot').notNull(),
  },
  (t) => [
    unique('seating_seat_plan_guest_uq').on(t.planId, t.guestId),
    unique('seating_seat_table_index_uq').on(t.tableId, t.seatIndex),
  ],
);

export const adminSession = pgTable(
  'admin_session',
  {
    /** sha256 du jeton du cookie : une fuite de la base ne donne pas de session utilisable. */
    id: text('id').primaryKey(),
    adminEmail: text('admin_email').notNull(),
    csrfToken: text('csrf_token').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('admin_session_expires_idx').on(t.expiresAt)],
);

export const rateLimitHit = pgTable(
  'rate_limit_hit',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** HMAC du contact ou de l'IP : aucune donnée personnelle en clair. */
    key: text('key').notNull(),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('rate_limit_key_at_idx').on(t.key, t.at)],
);

export const otpChallenge = pgTable('otp_challenge', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** null = défi factice (nom inconnu) : même réponse, pour ne rien révéler. */
  invitationId: uuid('invitation_id').references(() => invitation.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  attempts: smallint('attempts').notNull().default(0),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export type Invitation = typeof invitation.$inferSelect;
export type Guest = typeof guest.$inferSelect;
export type SendLog = typeof sendLog.$inferSelect;
export type CardSettings = typeof cardSettings.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type Wedding = typeof wedding.$inferSelect;
export type SeatingPlan = typeof seatingPlan.$inferSelect;
export type SeatingTable = typeof seatingTable.$inferSelect;
export type SeatingSeat = typeof seatingSeat.$inferSelect;
