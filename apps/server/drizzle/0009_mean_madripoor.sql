CREATE TABLE "currency_rates" (
	"base_currency" text PRIMARY KEY NOT NULL,
	"fetched_at" timestamp,
	"last_refresh_error" text,
	"next_refresh_at" timestamp,
	"provider" text NOT NULL,
	"rates_json" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "currency_rates_next_refresh_at_idx" ON "currency_rates" USING btree ("next_refresh_at");--> statement-breakpoint
CREATE INDEX "currency_rates_updated_at_idx" ON "currency_rates" USING btree ("updated_at");