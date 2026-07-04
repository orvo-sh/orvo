CREATE TYPE "public"."alert_delivery_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."alert_event_type" AS ENUM('opened', 'renotified', 'resolved', 'test');--> statement-breakpoint
CREATE TYPE "public"."alert_incident_entity_type" AS ENUM('app', 'container');--> statement-breakpoint
CREATE TYPE "public"."alert_incident_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_comparator" AS ENUM('gt', 'gte', 'lt', 'lte');--> statement-breakpoint
CREATE TYPE "public"."alert_signal_type" AS ENUM('error_rate', 'latency_p95_ms', 'latency_p99_ms', 'apdex', 'throughput_per_min', 'availability_percent', 'container_cpu_utilization', 'container_memory_utilization', 'container_reporting_stale');--> statement-breakpoint
CREATE TYPE "public"."heartbeat_monitor_status" AS ENUM('healthy', 'grace', 'missed', 'never_received');--> statement-breakpoint
CREATE TYPE "public"."incident_event_type" AS ENUM('incident.opened', 'incident.resolved', 'incident.dismissed', 'alert.fired', 'heartbeat.missed', 'heartbeat.recovered');--> statement-breakpoint
CREATE TYPE "public"."incident_dismiss_reason" AS ENUM('expected', 'false_positive', 'not_actionable', 'other');--> statement-breakpoint
CREATE TYPE "public"."incident_entity_type" AS ENUM('app', 'container');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."incident_source_type" AS ENUM('alert', 'heartbeat');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('alert_threshold', 'heartbeat_missed');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_event_type" AS ENUM('heartbeat.missed', 'heartbeat.recovered', 'alert.opened', 'alert.renotified', 'alert.resolved', 'destination.test');--> statement-breakpoint
CREATE TYPE "public"."notification_source_kind" AS ENUM('heartbeat', 'alert');--> statement-breakpoint
CREATE TYPE "public"."notification_destination_kind" AS ENUM('webhook', 'email');--> statement-breakpoint
CREATE TYPE "public"."billing_plan" AS ENUM('starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('trialing', 'active', 'past_due');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_delivery_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"destination_id" text NOT NULL,
	"rule_id" text,
	"incident_id" text,
	"event_id" text,
	"event_type" "alert_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "alert_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_number" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp,
	"delivered_at" timestamp,
	"http_status" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_event" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"rule_id" text,
	"incident_id" text,
	"event_type" "alert_event_type" NOT NULL,
	"window_start_at" timestamp,
	"window_end_at" timestamp,
	"observed_value" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_incident" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"entity_type" "alert_incident_entity_type" DEFAULT 'app' NOT NULL,
	"entity_id" text DEFAULT '' NOT NULL,
	"entity_name" text,
	"status" "alert_incident_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"last_observed_at" timestamp DEFAULT now() NOT NULL,
	"last_observed_value" real,
	"last_notified_at" timestamp,
	"renotify_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rule_destination" (
	"rule_id" text NOT NULL,
	"destination_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alert_rule_destination_pk" PRIMARY KEY("rule_id","destination_id")
);
--> statement-breakpoint
CREATE TABLE "alert_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"signal_type" "alert_signal_type" NOT NULL,
	"comparator" "alert_comparator" NOT NULL,
	"threshold" real NOT NULL,
	"window_minutes" integer NOT NULL,
	"renotify_minutes" integer,
	"apdex_target_ms" integer,
	"scope_services_include" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_services_exclude" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_span_names_include" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_span_names_exclude" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_environments_include" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_environments_exclude" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_scopes_include" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_scopes_exclude" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_container_names_include" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope_container_names_exclude" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"last_resolved_at" timestamp,
	"next_evaluation_at" timestamp DEFAULT now() NOT NULL,
	"last_evaluated_at" timestamp,
	"evaluation_lease_token" text,
	"evaluation_lease_expires_at" timestamp,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_webhook_destination" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"headers_encrypted" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_tested_at" timestamp,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"updated_by" text,
	"logs_first_received_at" timestamp,
	"traces_first_received_at" timestamp,
	"metrics_first_received_at" timestamp,
	"heartbeats_first_received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeat_monitor_destination" (
	"heartbeat_monitor_id" text NOT NULL,
	"destination_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "heartbeat_monitor_destination_pk" PRIMARY KEY("heartbeat_monitor_id","destination_id")
);
--> statement-breakpoint
CREATE TABLE "heartbeat_monitor" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"expected_every_seconds" integer NOT NULL,
	"grace_seconds" integer NOT NULL,
	"last_check_in_at" timestamp,
	"status" "heartbeat_monitor_status" DEFAULT 'never_received' NOT NULL,
	"paused_at" timestamp,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "heartbeat_monitor_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "incident_event" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"incident_id" text NOT NULL,
	"event_type" "incident_event_type" NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "ingestion_key" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"created_by" text,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_token" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"allowed_app_ids" text[] DEFAULT '{}'::text[] NOT NULL,
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
CREATE TABLE "notification_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"destination_id" text NOT NULL,
	"incident_id" text,
	"source_kind" "notification_source_kind" NOT NULL,
	"source_id" text NOT NULL,
	"event_type" "notification_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_number" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp,
	"delivered_at" timestamp,
	"http_status" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_destination" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "notification_destination_kind" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"webhook_url" text,
	"webhook_headers_encrypted" text,
	"email_recipients" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"logs_retention_days" integer NOT NULL,
	"traces_retention_days" integer NOT NULL,
	"metrics_retention_days" integer NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"logs_ingested_bytes" bigint DEFAULT 0 NOT NULL,
	"traces_ingested_bytes" bigint DEFAULT 0 NOT NULL,
	"metrics_ingested_bytes" bigint DEFAULT 0 NOT NULL,
	"ingest_limit_bytes" bigint NOT NULL,
	"notified_70_at" timestamp,
	"notified_85_at" timestamp,
	"notified_100_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"stripe_customer_id" text,
	"billing_plan" "billing_plan",
	"billing_status" "billing_status",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"reference_id" text NOT NULL,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'incomplete' NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancel_at" timestamp,
	"canceled_at" timestamp,
	"ended_at" timestamp,
	"seats" integer,
	"billing_interval" text,
	"stripe_schedule_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"stripe_customer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_destination_id_alert_webhook_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."alert_webhook_destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_incident_id_alert_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."alert_incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_event_id_alert_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."alert_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_incident_id_alert_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."alert_incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_incident" ADD CONSTRAINT "alert_incident_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_incident" ADD CONSTRAINT "alert_incident_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule_destination" ADD CONSTRAINT "alert_rule_destination_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule_destination" ADD CONSTRAINT "alert_rule_destination_destination_id_notification_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."notification_destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app" ADD CONSTRAINT "app_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app" ADD CONSTRAINT "app_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app" ADD CONSTRAINT "app_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor_destination" ADD CONSTRAINT "heartbeat_monitor_destination_heartbeat_monitor_id_heartbeat_monitor_id_fk" FOREIGN KEY ("heartbeat_monitor_id") REFERENCES "public"."heartbeat_monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor_destination" ADD CONSTRAINT "heartbeat_monitor_destination_destination_id_notification_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."notification_destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" ADD CONSTRAINT "heartbeat_monitor_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" ADD CONSTRAINT "heartbeat_monitor_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" ADD CONSTRAINT "heartbeat_monitor_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_dismissed_by_user_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_key" ADD CONSTRAINT "ingestion_key_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_key" ADD CONSTRAINT "ingestion_key_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_token" ADD CONSTRAINT "mcp_token_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_token" ADD CONSTRAINT "mcp_token_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_destination_id_notification_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."notification_destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD CONSTRAINT "notification_destination_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD CONSTRAINT "notification_destination_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD CONSTRAINT "notification_destination_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_usage" ADD CONSTRAINT "organization_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_app_id_idx" ON "alert_delivery_attempt" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_destination_id_idx" ON "alert_delivery_attempt" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_status_next_attempt_at_idx" ON "alert_delivery_attempt" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "alert_event_app_id_idx" ON "alert_event" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_event_rule_id_idx" ON "alert_event" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "alert_event_incident_id_idx" ON "alert_event" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "alert_incident_app_id_idx" ON "alert_incident" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_incident_rule_id_idx" ON "alert_incident" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "alert_incident_entity_type_entity_id_idx" ON "alert_incident" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_incident_one_open_per_rule_entity_uidx" ON "alert_incident" USING btree ("rule_id","entity_type","entity_id") WHERE "alert_incident"."status" = 'open';--> statement-breakpoint
CREATE INDEX "alert_rule_destination_destination_id_idx" ON "alert_rule_destination" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "alert_rule_app_id_idx" ON "alert_rule" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_rule_next_evaluation_at_idx" ON "alert_rule" USING btree ("next_evaluation_at");--> statement-breakpoint
CREATE INDEX "alert_rule_enabled_next_evaluation_at_idx" ON "alert_rule" USING btree ("is_enabled","next_evaluation_at");--> statement-breakpoint
CREATE INDEX "alert_webhook_destination_app_id_idx" ON "alert_webhook_destination" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_webhook_destination_created_by_idx" ON "alert_webhook_destination" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "app_organization_id_idx" ON "app" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "app_created_by_idx" ON "app" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "app_org_name_uidx" ON "app" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "heartbeat_monitor_destination_destination_id_idx" ON "heartbeat_monitor_destination" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "heartbeat_monitor_app_id_idx" ON "heartbeat_monitor" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "heartbeat_monitor_app_status_idx" ON "heartbeat_monitor" USING btree ("app_id","status");--> statement-breakpoint
CREATE INDEX "incident_event_app_id_idx" ON "incident_event" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "incident_event_incident_id_occurred_at_idx" ON "incident_event" USING btree ("incident_id","occurred_at");--> statement-breakpoint
CREATE INDEX "incident_app_id_idx" ON "incident" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "incident_app_id_status_opened_at_idx" ON "incident" USING btree ("app_id","status","opened_at");--> statement-breakpoint
CREATE INDEX "incident_source_type_source_id_idx" ON "incident" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "incident_entity_type_entity_id_idx" ON "incident" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "incident_source_key_idx" ON "incident" USING btree ("source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_one_open_per_source_key_uidx" ON "incident" USING btree ("source_key") WHERE "incident"."status" = 'open';--> statement-breakpoint
CREATE INDEX "ingestion_key_app_id_idx" ON "ingestion_key" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "ingestion_key_created_by_idx" ON "ingestion_key" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_key_key_uidx" ON "ingestion_key" USING btree ("key");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mcp_token_organization_id_idx" ON "mcp_token" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mcp_token_created_by_idx" ON "mcp_token" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_token_token_prefix_uidx" ON "mcp_token" USING btree ("token_prefix");--> statement-breakpoint
CREATE INDEX "notification_delivery_app_id_idx" ON "notification_delivery" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_destination_id_idx" ON "notification_delivery" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_incident_id_idx" ON "notification_delivery" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_status_next_attempt_at_idx" ON "notification_delivery" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_delivery_source_idx" ON "notification_delivery" USING btree ("source_kind","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_usage_organization_id_uidx" ON "organization_usage" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_reference_id_idx" ON "subscription" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_stripe_subscription_id_uidx" ON "subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");