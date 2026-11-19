-- Reset prelaunch alert data instead of maintaining signal-type compatibility.
DELETE FROM "notification_delivery" WHERE "source_kind" = 'alert';
--> statement-breakpoint
DELETE FROM "incident" WHERE "source_type" = 'alert';
--> statement-breakpoint
DELETE FROM "alert_rule";
--> statement-breakpoint
ALTER TABLE "alert_rule" DROP COLUMN "signal_type";--> statement-breakpoint
ALTER TABLE "alert_rule" DROP COLUMN "apdex_target_ms";--> statement-breakpoint
DROP TYPE "public"."alert_signal_type";