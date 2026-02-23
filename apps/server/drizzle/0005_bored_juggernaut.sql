ALTER TABLE "tracked_listings" RENAME COLUMN "id" TO "listing_id";--> statement-breakpoint
DROP INDEX "product_keyword_ranks_tenant_listing_observed_idx";--> statement-breakpoint
ALTER TABLE "product_keyword_ranks" ADD COLUMN "listing_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "product_keyword_ranks" ADD CONSTRAINT "product_keyword_ranks_listing_id_tracked_listings_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."tracked_listings"("listing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_etsy_listing_observed_idx" ON "product_keyword_ranks" USING btree ("tenant_id","etsy_listing_id","observed_at");--> statement-breakpoint
CREATE INDEX "product_keyword_ranks_tenant_listing_observed_idx" ON "product_keyword_ranks" USING btree ("tenant_id","listing_id","observed_at");