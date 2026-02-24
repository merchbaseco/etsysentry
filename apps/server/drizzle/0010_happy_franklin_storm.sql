CREATE TABLE "accounts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clerk_identities" (
	"account_id" text NOT NULL,
	"clerk_issuer" text NOT NULL,
	"clerk_org_id" text,
	"clerk_subject" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clerk_identities_issuer_subject_pk" PRIMARY KEY("clerk_issuer","clerk_subject")
);
--> statement-breakpoint
ALTER TABLE "etsy_api_call_events" RENAME COLUMN "tenant_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "etsy_oauth_connections" RENAME COLUMN "tenant_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "event_logs" RENAME COLUMN "tenant_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "product_keyword_ranks" RENAME COLUMN "tenant_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "tracked_keywords" RENAME COLUMN "tenant_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "tracked_listings" RENAME COLUMN "tenant_id" TO "account_id";--> statement-breakpoint
DROP INDEX "etsy_oauth_connections_clerk_user_idx";--> statement-breakpoint
DROP INDEX "etsy_oauth_connections_tenant_idx";--> statement-breakpoint
DROP INDEX "tracked_keywords_tenant_idx";--> statement-breakpoint
DROP INDEX "tracked_listings_tenant_idx";--> statement-breakpoint
DROP INDEX "etsy_api_call_events_tenant_created_at_idx";--> statement-breakpoint
DROP INDEX "etsy_api_call_events_tenant_clerk_created_at_idx";--> statement-breakpoint
DROP INDEX "event_logs_tenant_occurred_at_idx";--> statement-breakpoint
DROP INDEX "event_logs_tenant_primitive_occurred_at_idx";--> statement-breakpoint
DROP INDEX "event_logs_tenant_listing_occurred_at_idx";--> statement-breakpoint
DROP INDEX "event_logs_tenant_shop_occurred_at_idx";--> statement-breakpoint
DROP INDEX "event_logs_tenant_monitor_run_occurred_at_idx";--> statement-breakpoint
DROP INDEX "product_keyword_ranks_tenant_keyword_observed_idx";--> statement-breakpoint
DROP INDEX "product_keyword_ranks_tenant_listing_observed_idx";--> statement-breakpoint
DROP INDEX "product_keyword_ranks_tenant_etsy_listing_observed_idx";--> statement-breakpoint
DROP INDEX "product_keyword_ranks_tenant_keyword_rank_idx";--> statement-breakpoint
DROP INDEX "tracked_keywords_tenant_keyword_unique";--> statement-breakpoint
DROP INDEX "tracked_keywords_tenant_tracker_idx";--> statement-breakpoint
DROP INDEX "tracked_listings_tenant_listing_unique";--> statement-breakpoint
DROP INDEX "tracked_listings_tenant_tracker_idx";--> statement-breakpoint
ALTER TABLE "etsy_oauth_connections" DROP CONSTRAINT "etsy_oauth_connections_tenant_clerk_pk";--> statement-breakpoint
ALTER TABLE "clerk_identities" ADD CONSTRAINT "clerk_identities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clerk_identities_account_idx" ON "clerk_identities" USING btree ("account_id");--> statement-breakpoint
INSERT INTO "accounts" ("id")
SELECT DISTINCT "account_id"
FROM (
	SELECT "account_id" FROM "etsy_oauth_connections"
	UNION
	SELECT "account_id" FROM "tracked_listings"
	UNION
	SELECT "account_id" FROM "tracked_keywords"
	UNION
	SELECT "account_id" FROM "product_keyword_ranks"
	UNION
	SELECT "account_id" FROM "event_logs"
	UNION
	SELECT "account_id" FROM "etsy_api_call_events"
) AS "legacy_account_ids"
WHERE "account_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "etsy_oauth_connections" ADD CONSTRAINT "etsy_oauth_connections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tracked_keywords_account_idx" ON "tracked_keywords" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tracked_listings_account_idx" ON "tracked_listings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "etsy_api_call_events_tenant_created_at_idx" ON "etsy_api_call_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "etsy_api_call_events_tenant_clerk_created_at_idx" ON "etsy_api_call_events" USING btree ("account_id","clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_occurred_at_idx" ON "event_logs" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_primitive_occurred_at_idx" ON "event_logs" USING btree ("account_id","primitive_type","occurred_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_listing_occurred_at_idx" ON "event_logs" USING btree ("account_id","listing_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_shop_occurred_at_idx" ON "event_logs" USING btree ("account_id","shop_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_monitor_run_occurred_at_idx" ON "event_logs" USING btree ("account_id","monitor_run_id","occurred_at");--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_keyword_observed_idx" ON "product_keyword_ranks" USING btree ("account_id","tracked_keyword_id","observed_at");--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_listing_observed_idx" ON "product_keyword_ranks" USING btree ("account_id","listing_id","observed_at");--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_etsy_listing_observed_idx" ON "product_keyword_ranks" USING btree ("account_id","etsy_listing_id","observed_at");--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_keyword_rank_idx" ON "product_keyword_ranks" USING btree ("account_id","tracked_keyword_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_keywords_tenant_keyword_unique" ON "tracked_keywords" USING btree ("account_id","normalized_keyword");--> statement-breakpoint
CREATE INDEX "tracked_keywords_tenant_tracker_idx" ON "tracked_keywords" USING btree ("account_id","tracker_clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_listings_tenant_listing_unique" ON "tracked_listings" USING btree ("account_id","etsy_listing_id");--> statement-breakpoint
CREATE INDEX "tracked_listings_tenant_tracker_idx" ON "tracked_listings" USING btree ("account_id","tracker_clerk_user_id");--> statement-breakpoint
ALTER TABLE "etsy_oauth_connections" DROP COLUMN "clerk_user_id";
