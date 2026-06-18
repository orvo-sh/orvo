ALTER TABLE "heartbeat_monitor" RENAME COLUMN "secret_token" TO "token";--> statement-breakpoint
DROP INDEX "heartbeat_monitor_secret_token_uidx";--> statement-breakpoint
DROP INDEX "notification_destination_app_id_idx";--> statement-breakpoint
DROP INDEX "notification_destination_kind_idx";--> statement-breakpoint
DROP INDEX "notification_destination_created_by_idx";--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" ADD COLUMN "paused_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification_destination" DROP COLUMN "last_tested_at";--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" ADD CONSTRAINT "heartbeat_monitor_token_unique" UNIQUE("token");