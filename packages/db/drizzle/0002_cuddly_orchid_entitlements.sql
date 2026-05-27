CREATE TABLE "entitlements" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"plan_key" text,
	"source" text DEFAULT 'default' NOT NULL,
	"logs_retention_days" integer DEFAULT 30 NOT NULL,
	"traces_retention_days" integer DEFAULT 14 NOT NULL,
	"metrics_retention_days" integer DEFAULT 90 NOT NULL,
	"max_ingest_bytes_monthly" bigint,
	"max_stored_bytes" bigint,
	"max_telemetry_events_monthly" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "entitlements_plan_key_idx" ON "entitlements" USING btree ("plan_key");
