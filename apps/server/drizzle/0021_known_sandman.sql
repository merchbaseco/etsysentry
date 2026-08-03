ALTER TABLE "api_keys" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clerk_identities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "api_keys" CASCADE;--> statement-breakpoint
DROP TABLE "clerk_identities" CASCADE;--> statement-breakpoint
DROP INDEX "etsy_api_call_events_tenant_clerk_created_at_idx";--> statement-breakpoint
DROP INDEX "tracked_keywords_tenant_tracker_idx";--> statement-breakpoint
DROP INDEX "tracked_listings_tenant_tracker_idx";--> statement-breakpoint
ALTER TABLE "etsy_api_call_events" DROP COLUMN "clerk_user_id";--> statement-breakpoint
ALTER TABLE "tracked_keywords" DROP COLUMN "tracker_clerk_user_id";--> statement-breakpoint
ALTER TABLE "tracked_listings" DROP COLUMN "tracker_clerk_user_id";