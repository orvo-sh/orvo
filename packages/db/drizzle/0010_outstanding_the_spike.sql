ALTER TABLE "organization_usage" ADD COLUMN "ingest_overage_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_usage" ADD COLUMN "ingest_overage_budget_cents" integer;--> statement-breakpoint
ALTER TABLE "organization_usage" ADD COLUMN "scout_overage_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_usage" ADD COLUMN "scout_overage_budget_cents" integer;