CREATE TYPE "public"."tracked_listing_sync_state" AS ENUM('idle', 'queued', 'syncing');--> statement-breakpoint
ALTER TABLE "tracked_listings" ADD COLUMN "sync_state" "tracked_listing_sync_state" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
CREATE INDEX "tracked_listings_sync_state_idx" ON "tracked_listings" USING btree ("sync_state");