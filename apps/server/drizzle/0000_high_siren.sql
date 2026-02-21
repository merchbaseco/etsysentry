CREATE TYPE "public"."tracked_listing_etsy_state" AS ENUM('active', 'inactive', 'sold_out', 'draft', 'expired');--> statement-breakpoint
CREATE TYPE "public"."tracked_listing_tracking_state" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TABLE "tracked_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"tracker_clerk_user_id" text NOT NULL,
	"etsy_listing_id" text NOT NULL,
	"shop_id" text,
	"title" text NOT NULL,
	"url" text,
	"tracking_state" "tracked_listing_tracking_state" DEFAULT 'active' NOT NULL,
	"etsy_state" "tracked_listing_etsy_state" DEFAULT 'inactive' NOT NULL,
	"price_amount" integer,
	"price_divisor" integer,
	"price_currency_code" text,
	"quantity" integer,
	"views" integer,
	"num_favorers" integer,
	"updated_timestamp" integer,
	"last_refreshed_at" timestamp DEFAULT now() NOT NULL,
	"last_refresh_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_listings_tenant_listing_unique" ON "tracked_listings" USING btree ("tenant_id","etsy_listing_id");--> statement-breakpoint
CREATE INDEX "tracked_listings_tenant_idx" ON "tracked_listings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tracked_listings_tenant_tracker_idx" ON "tracked_listings" USING btree ("tenant_id","tracker_clerk_user_id");--> statement-breakpoint
CREATE INDEX "tracked_listings_tracking_state_idx" ON "tracked_listings" USING btree ("tracking_state");--> statement-breakpoint
CREATE INDEX "tracked_listings_updated_at_idx" ON "tracked_listings" USING btree ("updated_at");