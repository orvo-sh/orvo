ALTER TYPE "public"."alert_signal_type" ADD VALUE 'metric';--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "metric_type" text;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "metric_is_monotonic" boolean DEFAULT false NOT NULL;