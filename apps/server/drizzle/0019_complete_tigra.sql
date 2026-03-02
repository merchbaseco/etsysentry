ALTER TABLE "listing_metric_snapshots" ADD COLUMN "ending_timestamp" integer;--> statement-breakpoint
ALTER TABLE "tracked_listings" ADD COLUMN "ending_timestamp" integer;--> statement-breakpoint
ALTER TABLE "tracked_listings" ADD COLUMN "should_auto_renew" boolean;