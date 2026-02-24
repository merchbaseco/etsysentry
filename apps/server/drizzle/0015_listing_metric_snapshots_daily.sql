CREATE TABLE "listing_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"observed_date" date NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"views" integer,
	"favorer_count" integer,
	"quantity" integer,
	"price_amount" integer,
	"price_divisor" integer,
	"price_currency_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_metric_snapshots" ADD CONSTRAINT "listing_metric_snapshots_listing_id_tracked_listings_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."tracked_listings"("listing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_metric_snapshots_tenant_listing_day_unique" ON "listing_metric_snapshots" USING btree ("account_id","listing_id","observed_date");--> statement-breakpoint
CREATE INDEX "listing_metric_snapshots_tenant_listing_observed_at_idx" ON "listing_metric_snapshots" USING btree ("account_id","listing_id","observed_at");--> statement-breakpoint
CREATE INDEX "listing_metric_snapshots_tenant_observed_date_idx" ON "listing_metric_snapshots" USING btree ("account_id","observed_date");