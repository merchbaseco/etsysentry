CREATE TYPE "public"."access_projection_access" AS ENUM('granted', 'not_granted');--> statement-breakpoint
CREATE TYPE "public"."access_projection_state" AS ENUM('active', 'tombstone');--> statement-breakpoint
CREATE TABLE "access_projection_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"source_updated_at" bigint NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_projection" (
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"state" "access_projection_state" NOT NULL,
	"merchbase_user_id" text,
	"access" "access_projection_access",
	"access_valid_until" bigint,
	"source_updated_at" bigint NOT NULL,
	"last_event_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "access_projection_issuer_subject_pk" PRIMARY KEY("issuer","subject")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "merchbase_user_id" text;--> statement-breakpoint
CREATE INDEX "access_projection_event_identity_idx" ON "access_projection_event" USING btree ("issuer","subject");--> statement-breakpoint
CREATE INDEX "access_projection_merchbase_user_id_idx" ON "access_projection" USING btree ("merchbase_user_id");--> statement-breakpoint
CREATE INDEX "access_projection_state_updated_at_idx" ON "access_projection" USING btree ("state","source_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_merchbase_user_id_unique" ON "accounts" USING btree ("merchbase_user_id");