CREATE TABLE "etsy_api_call_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "etsy_api_call_events_tenant_created_at_idx" ON "etsy_api_call_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "etsy_api_call_events_tenant_clerk_created_at_idx" ON "etsy_api_call_events" USING btree ("tenant_id","clerk_user_id","created_at");