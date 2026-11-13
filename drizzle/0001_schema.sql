CREATE TYPE "public"."host_agreement" AS ENUM('invite', 'invitee');--> statement-breakpoint
CREATE TYPE "public"."invitation_kind" AS ENUM('guest', 'couple');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('not_sent', 'sent', 'opened', 'started', 'submitted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."send_channel" AS ENUM('email', 'whatsapp', 'lien');--> statement-breakpoint
CREATE TYPE "public"."send_purpose" AS ENUM('invitation', 'relance', 'lien_perdu', 'code');--> statement-breakpoint
CREATE TYPE "public"."send_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."table_shape" AS ENUM('round', 'rect');--> statement-breakpoint
CREATE TABLE "admin_session" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_email" text NOT NULL,
	"csrf_token" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"names" text NOT NULL,
	"date_label" text NOT NULL,
	"place" text NOT NULL,
	"ceremony_time" text NOT NULL,
	"reception_time" text NOT NULL,
	"message" text NOT NULL,
	"photo_key" text,
	"names_image_key" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_settings_singleton_ck" CHECK ("card_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "guest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"notes" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_invitation_position_uq" UNIQUE("invitation_id","position"),
	CONSTRAINT "guest_position_ck" CHECK ("guest"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"kind" "invitation_kind" DEFAULT 'guest' NOT NULL,
	"display_name" text NOT NULL,
	"contact_first_name" text NOT NULL,
	"contact_last_name" text NOT NULL,
	"email" text,
	"phone_e164" text,
	"host_agreement" "host_agreement" DEFAULT 'invite' NOT NULL,
	"max_seats" smallint DEFAULT 6 NOT NULL,
	"status" "invitation_status" DEFAULT 'not_sent' NOT NULL,
	"draft" jsonb,
	"draft_updated_at" timestamp (3) with time zone,
	"first_sent_at" timestamp (3) with time zone,
	"opened_at" timestamp (3) with time zone,
	"responded_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_max_seats_ck" CHECK ("invitation"."max_seats" between 1 and 6),
	CONSTRAINT "invitation_token_ck" CHECK ("invitation"."token" ~ '^[A-Za-z0-9_-]{22}$')
);
--> statement-breakpoint
CREATE TABLE "message_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"send_log_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp (3) with time zone,
	"last_error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"consumed_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seating_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seating_seat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"seat_index" smallint NOT NULL,
	"guest_id" uuid,
	"guest_name_snapshot" text NOT NULL,
	CONSTRAINT "seating_seat_plan_guest_uq" UNIQUE("plan_id","guest_id"),
	CONSTRAINT "seating_seat_table_index_uq" UNIQUE("table_id","seat_index")
);
--> statement-breakpoint
CREATE TABLE "seating_table" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"shape" "table_shape" NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"seat_count" smallint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "seating_table_seats_ck" CHECK ("seating_table"."seat_count" between 2 and 16)
);
--> statement-breakpoint
CREATE TABLE "send_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"channel" "send_channel" NOT NULL,
	"purpose" "send_purpose" NOT NULL,
	"status" "send_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp (3) with time zone,
	"delivered_at" timestamp (3) with time zone,
	"read_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"rsvp_deadline" timestamp (3) with time zone NOT NULL,
	"public_rsvp_enabled" boolean DEFAULT false NOT NULL,
	"purge_at" timestamp (3) with time zone NOT NULL,
	"purged_at" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton_ck" CHECK ("site_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "guest" ADD CONSTRAINT "guest_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_job" ADD CONSTRAINT "message_job_send_log_id_send_log_id_fk" FOREIGN KEY ("send_log_id") REFERENCES "public"."send_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_challenge" ADD CONSTRAINT "otp_challenge_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seating_seat" ADD CONSTRAINT "seating_seat_plan_id_seating_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."seating_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seating_seat" ADD CONSTRAINT "seating_seat_table_id_seating_table_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."seating_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seating_seat" ADD CONSTRAINT "seating_seat_guest_id_guest_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seating_table" ADD CONSTRAINT "seating_table_plan_id_seating_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."seating_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_log" ADD CONSTRAINT "send_log_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_session_expires_idx" ON "admin_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "guest_invitation_idx" ON "guest" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "guest_name_trgm" ON "guest" USING gin (f_unaccent(lower("first_name" || ' ' || "last_name")) gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_token_uq" ON "invitation" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "invitation_phone_idx" ON "invitation" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "invitation_contact_trgm" ON "invitation" USING gin (f_unaccent(lower("contact_first_name" || ' ' || "contact_last_name")) gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "message_job_send_log_uq" ON "message_job" USING btree ("send_log_id");--> statement-breakpoint
CREATE INDEX "message_job_due_idx" ON "message_job" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "rate_limit_key_at_idx" ON "rate_limit_hit" USING btree ("key","at");--> statement-breakpoint
CREATE UNIQUE INDEX "seating_plan_one_active_uq" ON "seating_plan" USING btree ("is_active") WHERE "seating_plan"."is_active";--> statement-breakpoint
CREATE INDEX "seating_table_plan_idx" ON "seating_table" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "send_log_invitation_idx" ON "send_log" USING btree ("invitation_id","created_at");--> statement-breakpoint
CREATE INDEX "send_log_provider_idx" ON "send_log" USING btree ("provider_message_id");