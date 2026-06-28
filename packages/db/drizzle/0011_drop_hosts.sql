DELETE FROM "incident_event"
WHERE "event_type" IN (
  'host.agent_disconnected',
  'host.offline',
  'host.recovered'
);--> statement-breakpoint

DELETE FROM "incident"
WHERE "source_type" = 'host'
   OR "entity_type" = 'host'
   OR "type" IN ('host_agent_disconnected', 'host_offline');--> statement-breakpoint

DELETE FROM "alert_incident"
WHERE "entity_type" = 'host';--> statement-breakpoint

DELETE FROM "alert_rule"
WHERE "signal_type" IN (
  'host_cpu_utilization',
  'host_memory_utilization',
  'host_filesystem_utilization',
  'host_reporting_stale'
);--> statement-breakpoint

ALTER TYPE "public"."alert_signal_type" RENAME TO "alert_signal_type__old";--> statement-breakpoint
CREATE TYPE "public"."alert_signal_type" AS ENUM(
  'error_rate',
  'latency_p95_ms',
  'latency_p99_ms',
  'apdex',
  'throughput_per_min',
  'availability_percent',
  'container_cpu_utilization',
  'container_memory_utilization',
  'container_reporting_stale'
);--> statement-breakpoint
ALTER TABLE "alert_rule"
  ALTER COLUMN "signal_type"
  TYPE "public"."alert_signal_type"
  USING ("signal_type"::text::"public"."alert_signal_type");--> statement-breakpoint
DROP TYPE "public"."alert_signal_type__old";--> statement-breakpoint

ALTER TYPE "public"."alert_incident_entity_type" RENAME TO "alert_incident_entity_type__old";--> statement-breakpoint
CREATE TYPE "public"."alert_incident_entity_type" AS ENUM('app', 'container');--> statement-breakpoint
ALTER TABLE "alert_incident" ALTER COLUMN "entity_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "alert_incident"
  ALTER COLUMN "entity_type"
  TYPE "public"."alert_incident_entity_type"
  USING ("entity_type"::text::"public"."alert_incident_entity_type");--> statement-breakpoint
ALTER TABLE "alert_incident" ALTER COLUMN "entity_type" SET DEFAULT 'app';--> statement-breakpoint
DROP TYPE "public"."alert_incident_entity_type__old";--> statement-breakpoint

ALTER TYPE "public"."incident_source_type" RENAME TO "incident_source_type__old";--> statement-breakpoint
CREATE TYPE "public"."incident_source_type" AS ENUM('alert', 'heartbeat');--> statement-breakpoint
ALTER TABLE "incident"
  ALTER COLUMN "source_type"
  TYPE "public"."incident_source_type"
  USING ("source_type"::text::"public"."incident_source_type");--> statement-breakpoint
DROP TYPE "public"."incident_source_type__old";--> statement-breakpoint

ALTER TYPE "public"."incident_entity_type" RENAME TO "incident_entity_type__old";--> statement-breakpoint
CREATE TYPE "public"."incident_entity_type" AS ENUM('app', 'container');--> statement-breakpoint
ALTER TABLE "incident" ALTER COLUMN "entity_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "incident"
  ALTER COLUMN "entity_type"
  TYPE "public"."incident_entity_type"
  USING ("entity_type"::text::"public"."incident_entity_type");--> statement-breakpoint
ALTER TABLE "incident" ALTER COLUMN "entity_type" SET DEFAULT 'app';--> statement-breakpoint
DROP TYPE "public"."incident_entity_type__old";--> statement-breakpoint

ALTER TYPE "public"."incident_type" RENAME TO "incident_type__old";--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('alert_threshold', 'heartbeat_missed');--> statement-breakpoint
ALTER TABLE "incident"
  ALTER COLUMN "type"
  TYPE "public"."incident_type"
  USING ("type"::text::"public"."incident_type");--> statement-breakpoint
DROP TYPE "public"."incident_type__old";--> statement-breakpoint

ALTER TYPE "public"."incident_event_type" RENAME TO "incident_event_type__old";--> statement-breakpoint
CREATE TYPE "public"."incident_event_type" AS ENUM(
  'incident.opened',
  'incident.resolved',
  'incident.dismissed',
  'alert.fired',
  'heartbeat.missed',
  'heartbeat.recovered'
);--> statement-breakpoint
ALTER TABLE "incident_event"
  ALTER COLUMN "event_type"
  TYPE "public"."incident_event_type"
  USING ("event_type"::text::"public"."incident_event_type");--> statement-breakpoint
DROP TYPE "public"."incident_event_type__old";--> statement-breakpoint

ALTER TABLE "alert_rule" DROP COLUMN IF EXISTS "scope_host_names_include";--> statement-breakpoint
ALTER TABLE "alert_rule" DROP COLUMN IF EXISTS "scope_host_names_exclude";
