CREATE TYPE "public"."incident_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."incident_source_type" AS ENUM('alert', 'heartbeat', 'host');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."incident_entity_type" AS ENUM('app', 'host', 'container');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('alert_threshold', 'heartbeat_missed', 'host_agent_disconnected', 'host_offline');--> statement-breakpoint
CREATE TYPE "public"."incident_dismiss_reason" AS ENUM('expected', 'false_positive', 'not_actionable', 'other');--> statement-breakpoint
CREATE TYPE "public"."incident_event_type" AS ENUM('incident.opened', 'incident.resolved', 'incident.dismissed', 'alert.fired', 'heartbeat.missed', 'heartbeat.recovered', 'host.agent_disconnected', 'host.offline', 'host.recovered');--> statement-breakpoint

CREATE TABLE "incident" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text NOT NULL,
  "source_type" "incident_source_type" NOT NULL,
  "source_id" text NOT NULL,
  "source_key" text NOT NULL,
  "type" "incident_type" NOT NULL,
  "title" text NOT NULL,
  "severity" "incident_severity" NOT NULL,
  "status" "incident_status" DEFAULT 'open' NOT NULL,
  "service_name" text,
  "entity_type" "incident_entity_type" DEFAULT 'app' NOT NULL,
  "entity_id" text DEFAULT '' NOT NULL,
  "entity_name" text,
  "source_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "opened_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "dismissed_at" timestamp,
  "dismissed_reason" "incident_dismiss_reason",
  "dismissed_reason_text" text,
  "dismissed_by" text,
  "last_observed_at" timestamp DEFAULT now() NOT NULL,
  "last_observed_value" real,
  "last_notified_at" timestamp,
  "renotify_count" integer DEFAULT 0 NOT NULL,
  "suppressed_until_recovered" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "incident_event" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text NOT NULL,
  "incident_id" text NOT NULL,
  "event_type" "incident_event_type" NOT NULL,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "actor_user_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "notification_delivery" ADD COLUMN "incident_id" text;--> statement-breakpoint

ALTER TABLE "incident" ADD CONSTRAINT "incident_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_dismissed_by_user_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

INSERT INTO "incident" (
  "id",
  "app_id",
  "source_type",
  "source_id",
  "source_key",
  "type",
  "title",
  "severity",
  "status",
  "service_name",
  "entity_type",
  "entity_id",
  "entity_name",
  "source_snapshot",
  "opened_at",
  "resolved_at",
  "last_observed_at",
  "last_observed_value",
  "last_notified_at",
  "renotify_count",
  "suppressed_until_recovered",
  "created_at",
  "updated_at"
)
SELECT
  ai."id",
  ai."app_id",
  'alert'::"incident_source_type",
  ai."rule_id",
  'alert:' || ai."rule_id" || ':' || ai."entity_type"::text || ':' || ai."entity_id",
  'alert_threshold'::"incident_type",
  ar."name",
  'critical'::"incident_severity",
  CASE
    WHEN ai."status" = 'resolved' THEN 'resolved'::"incident_status"
    ELSE 'open'::"incident_status"
  END,
  ar."scope_services_include"[1],
  CASE
    WHEN ai."entity_type" = 'app' THEN 'app'::"incident_entity_type"
    WHEN ai."entity_type" = 'host' THEN 'host'::"incident_entity_type"
    ELSE 'container'::"incident_entity_type"
  END,
  ai."entity_id",
  ai."entity_name",
  jsonb_build_object(
    'appName', a."name",
    'ruleId', ar."id",
    'ruleName', ar."name",
    'signalType', ar."signal_type",
    'comparator', ar."comparator",
    'threshold', ar."threshold",
    'windowMinutes', ar."window_minutes",
    'renotifyMinutes', ar."renotify_minutes",
    'entityType', ai."entity_type",
    'entityId', ai."entity_id",
    'entityName', ai."entity_name"
  ),
  ai."opened_at",
  ai."resolved_at",
  ai."last_observed_at",
  ai."last_observed_value",
  ai."last_notified_at",
  ai."renotify_count",
  false,
  ai."created_at",
  ai."updated_at"
FROM "alert_incident" ai
INNER JOIN "alert_rule" ar ON ar."id" = ai."rule_id"
INNER JOIN "app" a ON a."id" = ai."app_id";--> statement-breakpoint

INSERT INTO "incident_event" (
  "id",
  "app_id",
  "incident_id",
  "event_type",
  "occurred_at",
  "metadata",
  "created_at"
)
SELECT
  ai."id" || '_opened',
  ai."app_id",
  ai."id",
  'incident.opened'::"incident_event_type",
  ai."opened_at",
  '{}'::jsonb,
  ai."created_at"
FROM "alert_incident" ai;--> statement-breakpoint

INSERT INTO "incident_event" (
  "id",
  "app_id",
  "incident_id",
  "event_type",
  "occurred_at",
  "metadata",
  "created_at"
)
SELECT
  ae."id" || '_incident',
  ae."app_id",
  ae."incident_id",
  CASE
    WHEN ae."event_type" = 'resolved' THEN 'incident.resolved'::"incident_event_type"
    ELSE 'alert.fired'::"incident_event_type"
  END,
  COALESCE(ae."window_end_at", ae."created_at"),
  jsonb_build_object(
    'windowStartAt', ae."window_start_at",
    'windowEndAt', ae."window_end_at",
    'observedValue', ae."observed_value"
  ),
  ae."created_at"
FROM "alert_event" ae
WHERE ae."incident_id" IS NOT NULL;--> statement-breakpoint

UPDATE "notification_delivery" nd
SET "incident_id" = nd."source_id"
WHERE nd."source_kind" = 'alert';--> statement-breakpoint

ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "incident_app_id_idx" ON "incident" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "incident_app_id_status_opened_at_idx" ON "incident" USING btree ("app_id","status","opened_at");--> statement-breakpoint
CREATE INDEX "incident_source_type_source_id_idx" ON "incident" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "incident_entity_type_entity_id_idx" ON "incident" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "incident_source_key_idx" ON "incident" USING btree ("source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_one_open_per_source_key_uidx" ON "incident" USING btree ("source_key") WHERE "incident"."status" = 'open';--> statement-breakpoint
CREATE INDEX "incident_event_app_id_idx" ON "incident_event" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "incident_event_incident_id_occurred_at_idx" ON "incident_event" USING btree ("incident_id","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_delivery_incident_id_idx" ON "notification_delivery" USING btree ("incident_id");
