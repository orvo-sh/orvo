CREATE TABLE "mcp_token" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text[] NOT NULL,
	"allowed_app_ids" text[] NOT NULL,
	"created_by" text,
	"last_used_at" timestamp,
	"last_used_ip" text,
	"last_used_user_agent" text,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_token" ADD CONSTRAINT "mcp_token_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mcp_token" ADD CONSTRAINT "mcp_token_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "mcp_token_organization_id_idx" ON "mcp_token" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "mcp_token_created_by_idx" ON "mcp_token" USING btree ("created_by");
--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_token_token_prefix_uidx" ON "mcp_token" USING btree ("token_prefix");
