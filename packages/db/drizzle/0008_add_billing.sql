ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription" (
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
CREATE INDEX IF NOT EXISTS "subscription_reference_id_idx" ON "subscription" USING btree ("reference_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_status_idx" ON "subscription" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_stripe_subscription_id_uidx" ON "subscription" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_billing_profile" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"billing_email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'organization_billing_profile_organization_id_organization_id_fk'
	) THEN
		ALTER TABLE "organization_billing_profile"
			ADD CONSTRAINT "organization_billing_profile_organization_id_organization_id_fk"
			FOREIGN KEY ("organization_id")
			REFERENCES "public"."organization"("id")
			ON DELETE cascade
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_billing_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"signal" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"used_bytes" bigint DEFAULT 0 NOT NULL,
	"included_bytes" bigint DEFAULT 0 NOT NULL,
	"overage_bytes" bigint DEFAULT 0 NOT NULL,
	"notified_70_at" timestamp,
	"notified_85_at" timestamp,
	"notified_100_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'organization_billing_usage_organization_id_organization_id_fk'
	) THEN
		ALTER TABLE "organization_billing_usage"
			ADD CONSTRAINT "organization_billing_usage_organization_id_organization_id_fk"
			FOREIGN KEY ("organization_id")
			REFERENCES "public"."organization"("id")
			ON DELETE cascade
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_billing_usage_organization_id_idx" ON "organization_billing_usage" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_billing_usage_period_signal_uidx" ON "organization_billing_usage" USING btree ("organization_id","signal","period_start","period_end");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_billing_notification" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'organization_billing_notification_organization_id_organization_id_fk'
	) THEN
		ALTER TABLE "organization_billing_notification"
			ADD CONSTRAINT "organization_billing_notification_organization_id_organization_id_fk"
			FOREIGN KEY ("organization_id")
			REFERENCES "public"."organization"("id")
			ON DELETE cascade
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_billing_notification_status_idx" ON "organization_billing_notification" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_billing_notification_next_attempt_at_idx" ON "organization_billing_notification" USING btree ("next_attempt_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_billing_notification_organization_id_idx" ON "organization_billing_notification" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN IF NOT EXISTS "logs_max_ingest_bytes_per_period" bigint;
--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN IF NOT EXISTS "traces_max_ingest_bytes_per_period" bigint;
--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN IF NOT EXISTS "metrics_max_ingest_bytes_per_period" bigint;
--> statement-breakpoint
UPDATE "entitlements"
SET
	"logs_max_ingest_bytes_per_period" = COALESCE("logs_max_ingest_bytes_per_period", "max_ingest_bytes_monthly"),
	"traces_max_ingest_bytes_per_period" = COALESCE("traces_max_ingest_bytes_per_period", "max_ingest_bytes_monthly"),
	"metrics_max_ingest_bytes_per_period" = COALESCE("metrics_max_ingest_bytes_per_period", "max_ingest_bytes_monthly")
WHERE
	"max_ingest_bytes_monthly" IS NOT NULL;
