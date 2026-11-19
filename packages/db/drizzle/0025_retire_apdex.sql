WITH resolved AS (
  UPDATE "incident"
  SET "status" = 'resolved', "resolved_at" = now(), "last_observed_at" = now()
  WHERE "source_type" = 'alert' AND "status" = 'open'
    AND "source_id" IN (
      SELECT "id" FROM "alert_rule"
      WHERE "signal_type" = 'apdex' OR "metric_name" = 'orvo.request.apdex'
    )
  RETURNING "id", "app_id"
)
INSERT INTO "incident_event" ("id", "app_id", "incident_id", "event_type", "occurred_at", "metadata")
SELECT 'inev_' || md5("id" || 'retire-apdex'), "app_id", "id", 'incident.resolved', now(), '{"reason":"condition_retired"}'::jsonb
FROM resolved;
--> statement-breakpoint
UPDATE "alert_rule"
SET "is_enabled" = false, "last_evaluation_status" = NULL,
    "evaluation_lease_token" = NULL, "evaluation_lease_expires_at" = NULL,
    "updated_at" = now()
WHERE "signal_type" = 'apdex' OR "metric_name" = 'orvo.request.apdex';
