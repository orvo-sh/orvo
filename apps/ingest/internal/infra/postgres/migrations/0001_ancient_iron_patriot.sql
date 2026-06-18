CREATE TYPE "public"."alert_incident_entity_type" AS ENUM('app', 'host', 'container');--> statement-breakpoint
ALTER TYPE "public"."alert_signal_type" ADD VALUE 'host_cpu_utilization';--> statement-breakpoint
ALTER TYPE "public"."alert_signal_type" ADD VALUE 'host_memory_utilization';--> statement-breakpoint
ALTER TYPE "public"."alert_signal_type" ADD VALUE 'host_filesystem_utilization';--> statement-breakpoint
ALTER TYPE "public"."alert_signal_type" ADD VALUE 'host_reporting_stale';--> statement-breakpoint
ALTER TYPE "public"."alert_signal_type" ADD VALUE 'container_cpu_utilization';--> statement-breakpoint
ALTER TYPE "public"."alert_signal_type" ADD VALUE 'container_memory_utilization';--> statement-breakpoint
ALTER TYPE "public"."alert_signal_type" ADD VALUE 'container_reporting_stale';--> statement-breakpoint
DROP INDEX "alert_incident_one_open_per_rule_uidx";--> statement-breakpoint
ALTER TABLE "alert_incident" ADD COLUMN "entity_type" "alert_incident_entity_type" DEFAULT 'app' NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_incident" ADD COLUMN "entity_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_incident" ADD COLUMN "entity_name" text;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "scope_host_names_include" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "scope_host_names_exclude" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "scope_container_names_include" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "scope_container_names_exclude" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "alert_incident_entity_type_entity_id_idx" ON "alert_incident" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_incident_one_open_per_rule_entity_uidx" ON "alert_incident" USING btree ("rule_id","entity_type","entity_id") WHERE "alert_incident"."status" = 'open';