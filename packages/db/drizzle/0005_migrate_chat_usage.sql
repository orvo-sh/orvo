UPDATE "organization_usage"
SET "chat_credits_included" = CASE "organization"."billing_plan"
  WHEN 'starter' THEN 150000
  WHEN 'pro' THEN 1200000
  ELSE 0
END
FROM "organization"
WHERE "organization"."id" = "organization_usage"."organization_id";--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.scout_usage') IS NOT NULL THEN
    UPDATE "organization_usage"
    SET "chat_credits_used" = COALESCE((
      SELECT SUM("scout_usage"."credits")
      FROM "scout_usage"
      WHERE "scout_usage"."organization_id" = "organization_usage"."organization_id"
        AND "scout_usage"."created_at" >= "organization_usage"."current_period_start"
        AND "scout_usage"."created_at" < "organization_usage"."current_period_end"
    ), 0);
  END IF;
END
$$;
