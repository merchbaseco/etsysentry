CREATE TABLE "etsy_oauth_connections" (
	"access_token" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refresh_token" text NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"tenant_id" text NOT NULL,
	"token_type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "etsy_oauth_connections_tenant_clerk_pk" PRIMARY KEY("tenant_id","clerk_user_id")
);
--> statement-breakpoint
CREATE INDEX "etsy_oauth_connections_clerk_user_idx" ON "etsy_oauth_connections" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "etsy_oauth_connections_tenant_idx" ON "etsy_oauth_connections" USING btree ("tenant_id");