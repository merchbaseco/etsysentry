CREATE TYPE "public"."tracked_keyword_sync_state" AS ENUM('idle', 'queued', 'syncing');--> statement-breakpoint
ALTER TABLE "tracked_keywords" ADD COLUMN "sync_state" "tracked_keyword_sync_state" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
CREATE INDEX "tracked_keywords_sync_state_idx" ON "tracked_keywords" USING btree ("sync_state");