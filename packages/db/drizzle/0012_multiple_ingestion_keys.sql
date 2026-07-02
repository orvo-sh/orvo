ALTER TABLE "ingestion_key" ADD COLUMN "name" text;
--> statement-breakpoint
UPDATE "ingestion_key"
SET "name" = CASE
  WHEN "kind" = 'private' THEN 'Default key'
  ELSE 'Migrated key'
END
WHERE "name" IS NULL;
--> statement-breakpoint
ALTER TABLE "ingestion_key" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
DROP INDEX "ingestion_key_one_active_kind_per_app_uidx";
--> statement-breakpoint
ALTER TABLE "ingestion_key" DROP CONSTRAINT "ingestion_key_public_prefix_check";
--> statement-breakpoint
ALTER TABLE "ingestion_key" DROP CONSTRAINT "ingestion_key_private_prefix_check";
--> statement-breakpoint
ALTER TABLE "ingestion_key" DROP COLUMN "kind";
--> statement-breakpoint
DROP TYPE "public"."ingestion_key_kind";
