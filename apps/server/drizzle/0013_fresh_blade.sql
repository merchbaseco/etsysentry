CREATE TYPE "public"."tracked_shop_sync_state" AS ENUM('idle', 'queued', 'syncing');--> statement-breakpoint
CREATE TYPE "public"."tracked_shop_tracking_state" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TABLE "tracked_shop_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"tracked_shop_id" uuid NOT NULL,
	"etsy_shop_id" text NOT NULL,
	"etsy_listing_id" text NOT NULL,
	"listing_updated_timestamp" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_changed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_shop_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"tracked_shop_id" uuid NOT NULL,
	"etsy_shop_id" text NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"active_listing_count" integer DEFAULT 0 NOT NULL,
	"new_listing_count" integer DEFAULT 0 NOT NULL,
	"favorites_total" integer,
	"favorites_delta" integer,
	"sold_total" integer,
	"sold_delta" integer,
	"review_total" integer,
	"review_delta" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_shops" (
	"tracked_shop_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"etsy_shop_id" text NOT NULL,
	"shop_name" text NOT NULL,
	"shop_url" text,
	"tracking_state" "tracked_shop_tracking_state" DEFAULT 'active' NOT NULL,
	"sync_state" "tracked_shop_sync_state" DEFAULT 'idle' NOT NULL,
	"last_refreshed_at" timestamp DEFAULT now() NOT NULL,
	"next_sync_at" timestamp DEFAULT now() NOT NULL,
	"last_refresh_error" text,
	"last_synced_listing_updated_timestamp" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracked_shop_listings" ADD CONSTRAINT "tracked_shop_listings_tracked_shop_id_tracked_shops_tracked_shop_id_fk" FOREIGN KEY ("tracked_shop_id") REFERENCES "public"."tracked_shops"("tracked_shop_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_shop_snapshots" ADD CONSTRAINT "tracked_shop_snapshots_tracked_shop_id_tracked_shops_tracked_shop_id_fk" FOREIGN KEY ("tracked_shop_id") REFERENCES "public"."tracked_shops"("tracked_shop_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_shop_listings_tenant_shop_listing_unique" ON "tracked_shop_listings" USING btree ("account_id","tracked_shop_id","etsy_listing_id");--> statement-breakpoint
CREATE INDEX "tracked_shop_listings_tenant_shop_active_idx" ON "tracked_shop_listings" USING btree ("account_id","tracked_shop_id","is_active");--> statement-breakpoint
CREATE INDEX "tracked_shop_listings_tenant_listing_idx" ON "tracked_shop_listings" USING btree ("account_id","etsy_listing_id");--> statement-breakpoint
CREATE INDEX "tracked_shop_listings_tenant_etsy_shop_idx" ON "tracked_shop_listings" USING btree ("account_id","etsy_shop_id");--> statement-breakpoint
CREATE INDEX "tracked_shop_snapshots_tenant_shop_observed_at_idx" ON "tracked_shop_snapshots" USING btree ("account_id","tracked_shop_id","observed_at");--> statement-breakpoint
CREATE INDEX "tracked_shop_snapshots_tenant_etsy_shop_observed_at_idx" ON "tracked_shop_snapshots" USING btree ("account_id","etsy_shop_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_shops_tenant_shop_unique" ON "tracked_shops" USING btree ("account_id","etsy_shop_id");--> statement-breakpoint
CREATE INDEX "tracked_shops_account_idx" ON "tracked_shops" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tracked_shops_tracking_state_idx" ON "tracked_shops" USING btree ("tracking_state");--> statement-breakpoint
CREATE INDEX "tracked_shops_sync_state_idx" ON "tracked_shops" USING btree ("sync_state");--> statement-breakpoint
CREATE INDEX "tracked_shops_next_sync_at_idx" ON "tracked_shops" USING btree ("next_sync_at");--> statement-breakpoint
CREATE INDEX "tracked_shops_updated_at_idx" ON "tracked_shops" USING btree ("updated_at");