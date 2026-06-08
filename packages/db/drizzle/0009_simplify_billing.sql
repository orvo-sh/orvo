ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "billing_email" text;
--> statement-breakpoint
UPDATE "organization" AS org
SET "billing_email" = profile."billing_email"
FROM "organization_billing_profile" AS profile
WHERE profile."organization_id" = org."id"
  AND org."billing_email" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_type
		WHERE typname = 'billing_signal'
	) THEN
		CREATE TYPE "billing_signal" AS ENUM ('logs', 'metrics', 'traces');
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "organization_billing_usage"
	ALTER COLUMN "signal" TYPE "billing_signal"
	USING "signal"::"billing_signal";
--> statement-breakpoint
DROP TABLE IF EXISTS "organization_billing_notification";
--> statement-breakpoint
DROP TABLE IF EXISTS "organization_billing_profile";
