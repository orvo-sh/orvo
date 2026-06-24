DROP INDEX "heartbeat_monitor_app_status_idx";--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" RENAME COLUMN "last_status" TO "status";--> statement-breakpoint
CREATE INDEX "heartbeat_monitor_app_status_idx" ON "heartbeat_monitor" USING btree ("app_id","status");--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" DROP COLUMN "last_missed_at";--> statement-breakpoint
ALTER TABLE "heartbeat_monitor" DROP COLUMN "last_recovered_at";
