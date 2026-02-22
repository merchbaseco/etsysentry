CREATE TYPE "public"."tracked_keyword_tracking_state" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TABLE "product_keyword_ranks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"tracked_keyword_id" uuid NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"rank" integer NOT NULL,
	"etsy_listing_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"tracker_clerk_user_id" text NOT NULL,
	"keyword" text NOT NULL,
	"normalized_keyword" text NOT NULL,
	"tracking_state" "tracked_keyword_tracking_state" DEFAULT 'active' NOT NULL,
	"last_refreshed_at" timestamp DEFAULT now() NOT NULL,
	"last_refresh_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_keyword_observed_idx" ON "product_keyword_ranks" USING btree ("tenant_id","tracked_keyword_id","observed_at");--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_listing_observed_idx" ON "product_keyword_ranks" USING btree ("tenant_id","etsy_listing_id","observed_at");--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_keyword_rank_idx" ON "product_keyword_ranks" USING btree ("tenant_id","tracked_keyword_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_keywords_tenant_keyword_unique" ON "tracked_keywords" USING btree ("tenant_id","normalized_keyword");--> statement-breakpoint
CREATE INDEX "tracked_keywords_tenant_idx" ON "tracked_keywords" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tracked_keywords_tenant_tracker_idx" ON "tracked_keywords" USING btree ("tenant_id","tracker_clerk_user_id");--> statement-breakpoint
CREATE INDEX "tracked_keywords_tracking_state_idx" ON "tracked_keywords" USING btree ("tracking_state");--> statement-breakpoint
CREATE INDEX "tracked_keywords_updated_at_idx" ON "tracked_keywords" USING btree ("updated_at");