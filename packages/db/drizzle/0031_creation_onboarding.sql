INSERT INTO "onboarding" ("user_id", "milestone", "completed_at")
SELECT "created_by", 'first_alert_rule_created', min("created_at")
FROM "alert_rule" WHERE "created_by" IS NOT NULL AND "is_draft" = false
GROUP BY "created_by"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "onboarding" ("user_id", "milestone", "completed_at")
SELECT "created_by", 'first_heartbeat_created', min("created_at")
FROM "heartbeat_monitor" WHERE "created_by" IS NOT NULL
GROUP BY "created_by"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "onboarding" WHERE "milestone" = 'scout_alert_rule_used';
