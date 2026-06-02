DO $$
BEGIN
	CREATE TYPE "public"."alert_signal_type" AS ENUM(
		'error_rate',
		'latency_p95_ms',
		'latency_p99_ms',
		'apdex',
		'throughput_per_min',
		'availability_percent'
	);
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."alert_comparator" AS ENUM('gt', 'gte', 'lt', 'lte');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."alert_incident_status" AS ENUM('open', 'resolved');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."alert_event_type" AS ENUM('opened', 'renotified', 'resolved', 'test');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."alert_delivery_status" AS ENUM('pending', 'succeeded', 'failed');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
CREATE TABLE "alert_webhook_destination" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
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
CREATE TABLE "alert_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
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
CREATE TABLE "alert_rule_destination" (
	"rule_id" text NOT NULL,
	"destination_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alert_rule_destination_pk" PRIMARY KEY("rule_id","destination_id")
);
--> statement-breakpoint
CREATE TABLE "alert_incident" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
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
CREATE TABLE "alert_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"rule_id" text,
	"incident_id" text,
	"event_type" "alert_event_type" NOT NULL,
	"window_start_at" timestamp,
	"window_end_at" timestamp,
	"observed_value" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_delivery_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
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
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_webhook_destination" ADD CONSTRAINT "alert_webhook_destination_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_rule_destination" ADD CONSTRAINT "alert_rule_destination_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_rule_destination" ADD CONSTRAINT "alert_rule_destination_destination_id_alert_webhook_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."alert_webhook_destination"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_incident" ADD CONSTRAINT "alert_incident_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_incident" ADD CONSTRAINT "alert_incident_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_incident_id_alert_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."alert_incident"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_destination_id_alert_webhook_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."alert_webhook_destination"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_incident_id_alert_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."alert_incident"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_delivery_attempt" ADD CONSTRAINT "alert_delivery_attempt_event_id_alert_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."alert_event"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "alert_webhook_destination_organization_id_idx" ON "alert_webhook_destination" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "alert_webhook_destination_created_by_idx" ON "alert_webhook_destination" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "alert_rule_organization_id_idx" ON "alert_rule" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "alert_rule_next_evaluation_at_idx" ON "alert_rule" USING btree ("next_evaluation_at");
--> statement-breakpoint
CREATE INDEX "alert_rule_enabled_next_evaluation_at_idx" ON "alert_rule" USING btree ("is_enabled","next_evaluation_at");
--> statement-breakpoint
CREATE INDEX "alert_rule_destination_destination_id_idx" ON "alert_rule_destination" USING btree ("destination_id");
--> statement-breakpoint
CREATE INDEX "alert_incident_organization_id_idx" ON "alert_incident" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "alert_incident_rule_id_idx" ON "alert_incident" USING btree ("rule_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "alert_incident_one_open_per_rule_uidx" ON "alert_incident" USING btree ("rule_id") WHERE "status" = 'open';
--> statement-breakpoint
CREATE INDEX "alert_event_organization_id_idx" ON "alert_event" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "alert_event_rule_id_idx" ON "alert_event" USING btree ("rule_id");
--> statement-breakpoint
CREATE INDEX "alert_event_incident_id_idx" ON "alert_event" USING btree ("incident_id");
--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_organization_id_idx" ON "alert_delivery_attempt" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_destination_id_idx" ON "alert_delivery_attempt" USING btree ("destination_id");
--> statement-breakpoint
CREATE INDEX "alert_delivery_attempt_status_next_attempt_at_idx" ON "alert_delivery_attempt" USING btree ("status","next_attempt_at");
