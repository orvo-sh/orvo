CREATE TYPE "public"."alert_delivery_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."alert_event_type" AS ENUM('opened', 'renotified', 'resolved', 'test');--> statement-breakpoint
CREATE TYPE "public"."alert_incident_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_comparator" AS ENUM('gt', 'gte', 'lt', 'lte');--> statement-breakpoint
CREATE TYPE "public"."alert_signal_type" AS ENUM('error_rate', 'latency_p95_ms', 'latency_p99_ms', 'apdex', 'throughput_per_min', 'availability_percent');--> statement-breakpoint
CREATE TYPE "public"."ingestion_key_kind" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."billing_plan" AS ENUM('starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('trailing', 'active', 'past_due');--> statement-breakpoint
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
	"default_timezone" text DEFAULT 'UTC' NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_log_view" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_key" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"kind" "ingestion_key_kind" NOT NULL,
	"key" text NOT NULL,
	"created_by" text,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "ingestion_key_public_prefix_check" CHECK (("ingestion_key"."kind" <> 'public'::ingestion_key_kind OR "ingestion_key"."key" LIKE 'pk_%')),
	CONSTRAINT "ingestion_key_private_prefix_check" CHECK (("ingestion_key"."kind" <> 'private'::ingestion_key_kind OR "ingestion_key"."key" LIKE 'sk_%'))
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
ALTER TABLE "task" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_key" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "task" CASCADE;--> statement-breakpoint
DROP TABLE "api_key" CASCADE;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_plan" "billing_plan";--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_status" "billing_status";--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "updated_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
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
ALTER TABLE "alert_rule_destination" ADD CONSTRAINT "alert_rule_destination_destination_id_alert_webhook_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."alert_webhook_destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app" ADD CONSTRAINT "app_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app" ADD CONSTRAINT "app_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app" ADD CONSTRAINT "app_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_log_view" ADD CONSTRAINT "dashboard_log_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_key" ADD CONSTRAINT "ingestion_key_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_key" ADD CONSTRAINT "ingestion_key_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_usage" ADD CONSTRAINT "organization_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_app_id_idx" ON "alert_delivery_attempt" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_destination_id_idx" ON "alert_delivery_attempt" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_status_next_attempt_at_idx" ON "alert_delivery_attempt" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "alert_event_app_id_idx" ON "alert_event" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_event_rule_id_idx" ON "alert_event" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "alert_event_incident_id_idx" ON "alert_event" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "alert_incident_app_id_idx" ON "alert_incident" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_incident_rule_id_idx" ON "alert_incident" USING btree ("rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_incident_one_open_per_rule_uidx" ON "alert_incident" USING btree ("rule_id") WHERE "alert_incident"."status" = 'open';--> statement-breakpoint
CREATE INDEX "alert_rule_destination_destination_id_idx" ON "alert_rule_destination" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "alert_rule_app_id_idx" ON "alert_rule" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_rule_next_evaluation_at_idx" ON "alert_rule" USING btree ("next_evaluation_at");--> statement-breakpoint
CREATE INDEX "alert_rule_enabled_next_evaluation_at_idx" ON "alert_rule" USING btree ("is_enabled","next_evaluation_at");--> statement-breakpoint
CREATE INDEX "alert_webhook_destination_app_id_idx" ON "alert_webhook_destination" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "alert_webhook_destination_created_by_idx" ON "alert_webhook_destination" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "app_organization_id_idx" ON "app" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "app_created_by_idx" ON "app" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "app_org_name_uidx" ON "app" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_log_view_user_name_uidx" ON "dashboard_log_view" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "ingestion_key_app_id_idx" ON "ingestion_key" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "ingestion_key_created_by_idx" ON "ingestion_key" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_key_key_uidx" ON "ingestion_key" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_key_one_active_kind_per_app_uidx" ON "ingestion_key" USING btree ("app_id","kind") WHERE "ingestion_key"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "subscription_reference_id_idx" ON "subscription" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_stripe_subscription_id_uidx" ON "subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "metadata";