DROP TABLE IF EXISTS "deployment";--> statement-breakpoint

DROP TYPE IF EXISTS "deployment_status";--> statement-breakpoint

DROP TYPE IF EXISTS "deployment_correlation_strategy";--> statement-breakpoint

DROP TABLE IF EXISTS "dashboard_log_view";--> statement-breakpoint

ALTER TABLE "app" DROP COLUMN IF EXISTS "deployments_first_received_at";