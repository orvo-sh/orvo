ALTER TYPE "public"."alert_signal_type" ADD VALUE 'custom_gauge';--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "metric_name" text;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "metric_aggregation" text;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "metric_unit" text;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "metric_attribute_filters" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "last_evaluation_status" text;