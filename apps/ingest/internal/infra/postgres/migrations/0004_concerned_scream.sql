CREATE TYPE "public"."heartbeat_monitor_status" AS ENUM('healthy', 'grace', 'missed', 'never_received');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_event_type" AS ENUM('heartbeat.missed', 'heartbeat.recovered', 'destination.test');--> statement-breakpoint
CREATE TYPE "public"."notification_source_kind" AS ENUM('heartbeat');--> statement-breakpoint
CREATE TYPE "public"."notification_destination_kind" AS ENUM('webhook', 'email');--> statement-breakpoint
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
	"secret_token" text NOT NULL,
	"expected_every_seconds" integer NOT NULL,
	"grace_seconds" integer NOT NULL,
	"last_check_in_at" timestamp,
	"last_status" "heartbeat_monitor_status" DEFAULT 'never_received' NOT NULL,
	"last_missed_at" timestamp,
	"last_recovered_at" timestamp,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"destination_id" text NOT NULL,
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
	"last_tested_at" timestamp,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app" ADD COLUMN "heartbeats_first_received_at" timestamp;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor_destination" ADD CONSTRAINT "heartbeat_monitor_destination_heartbeat_monitor_id_heartbeat_monitor_id_fk" FOREIGN KEY ("heartbeat_monitor_id") REFERENCES "public"."heartbeat_monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor_destination" ADD CONSTRAINT "heartbeat_monitor_destination_destination_id_notification_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."notification_destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" ADD CONSTRAINT "heartbeat_monitor_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" ADD CONSTRAINT "heartbeat_monitor_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" ADD CONSTRAINT "heartbeat_monitor_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_destination_id_notification_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."notification_destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD CONSTRAINT "notification_destination_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD CONSTRAINT "notification_destination_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD CONSTRAINT "notification_destination_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heartbeat_monitor_destination_destination_id_idx" ON "heartbeat_monitor_destination" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "heartbeat_monitor_app_id_idx" ON "heartbeat_monitor" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "heartbeat_monitor_app_status_idx" ON "heartbeat_monitor" USING btree ("app_id","last_status");--> statement-breakpoint
CREATE UNIQUE INDEX "heartbeat_monitor_secret_token_uidx" ON "heartbeat_monitor" USING btree ("secret_token");--> statement-breakpoint
CREATE INDEX "notification_delivery_app_id_idx" ON "notification_delivery" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_destination_id_idx" ON "notification_delivery" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_status_next_attempt_at_idx" ON "notification_delivery" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_delivery_source_idx" ON "notification_delivery" USING btree ("source_kind","source_id");--> statement-breakpoint
CREATE INDEX "notification_destination_app_id_idx" ON "notification_destination" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "notification_destination_kind_idx" ON "notification_destination" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "notification_destination_created_by_idx" ON "notification_destination" USING btree ("created_by");