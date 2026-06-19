ALTER TYPE "public"."notification_event_type" ADD VALUE 'alert.opened' BEFORE 'destination.test';--> statement-breakpoint
ALTER TYPE "public"."notification_event_type" ADD VALUE 'alert.renotified' BEFORE 'destination.test';--> statement-breakpoint
ALTER TYPE "public"."notification_event_type" ADD VALUE 'alert.resolved' BEFORE 'destination.test';--> statement-breakpoint
ALTER TYPE "public"."notification_source_kind" ADD VALUE 'alert';--> statement-breakpoint
INSERT INTO "notification_destination" (
  "id",
  "app_id",
  "name",
  "kind",
  "is_enabled",
  "webhook_url",
  "webhook_headers_encrypted",
  "email_recipients",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "app_id",
  "name",
  'webhook',
  "is_enabled",
  "url",
  "headers_encrypted",
  '{}'::text[],
  "created_by",
  "updated_by",
  "created_at",
  "updated_at"
FROM "alert_webhook_destination"
WHERE NOT EXISTS (
  SELECT 1
  FROM "notification_destination"
  WHERE "notification_destination"."id" = "alert_webhook_destination"."id"
);--> statement-breakpoint
ALTER TABLE "alert_rule_destination" DROP CONSTRAINT "alert_rule_destination_destination_id_alert_webhook_destination_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_rule_destination" ADD CONSTRAINT "alert_rule_destination_destination_id_notification_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."notification_destination"("id") ON DELETE cascade ON UPDATE no action;
