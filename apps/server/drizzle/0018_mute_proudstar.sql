CREATE TABLE "listing_tags" (
	"listing_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "listing_tags_listing_tag_pk" PRIMARY KEY("listing_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_tag" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_tags" ADD CONSTRAINT "listing_tags_listing_id_tracked_listings_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."tracked_listings"("listing_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_tags" ADD CONSTRAINT "listing_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_tags_tag_idx" ON "listing_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_normalized_tag_unique" ON "tags" USING btree ("normalized_tag");