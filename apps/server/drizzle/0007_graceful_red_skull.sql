CREATE TYPE "public"."event_log_level" AS ENUM('info', 'warn', 'error', 'debug');--> statement-breakpoint
CREATE TYPE "public"."event_log_primitive_type" AS ENUM('keyword', 'listing', 'shop', 'system');--> statement-breakpoint
CREATE TYPE "public"."event_log_status" AS ENUM('success', 'failed', 'pending', 'retrying', 'partial');--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"level" "event_log_level" NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"status" "event_log_status" NOT NULL,
	"primitive_type" "event_log_primitive_type" NOT NULL,
	"primitive_id" text,
	"listing_id" text,
	"shop_id" text,
	"keyword" text,
	"message" text NOT NULL,
	"details_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"monitor_run_id" text,
	"request_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "event_logs_tenant_occurred_at_idx" ON "event_logs" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_primitive_occurred_at_idx" ON "event_logs" USING btree ("tenant_id","primitive_type","occurred_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_listing_occurred_at_idx" ON "event_logs" USING btree ("tenant_id","listing_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_shop_occurred_at_idx" ON "event_logs" USING btree ("tenant_id","shop_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_logs_tenant_monitor_run_occurred_at_idx" ON "event_logs" USING btree ("tenant_id","monitor_run_id","occurred_at");