DELETE FROM "notification_delivery"
WHERE "source_kind" = 'alert' AND "source_id" IN (
  SELECT "id" FROM "alert_rule" WHERE "metric_name" = '$request.success_rate'
);
--> statement-breakpoint
DELETE FROM "incident"
WHERE "source_type" = 'alert' AND "source_id" IN (
  SELECT "id" FROM "alert_rule" WHERE "metric_name" = '$request.success_rate'
);
--> statement-breakpoint
DELETE FROM "alert_rule" WHERE "metric_name" = '$request.success_rate';
--> statement-breakpoint
UPDATE "alert_rule"
SET "metric_name" = '$request.error_count', "updated_at" = now(),
    "last_evaluation_status" = NULL, "next_evaluation_at" = now()
WHERE "metric_name" = '$request.error.count';
