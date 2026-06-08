ALTER TABLE "dashboard_log_view" RENAME COLUMN "filters" TO "definition";--> statement-breakpoint
ALTER TABLE "dashboard_log_view" RENAME COLUMN "user_id" TO "created_by";--> statement-breakpoint
ALTER TABLE "dashboard_log_view" DROP CONSTRAINT "dashboard_log_view_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "billing_status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "organization" SET "billing_status" = 'trialing' WHERE "billing_status" = 'trailing';--> statement-breakpoint
DROP TYPE "public"."billing_status";--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('trialing', 'active', 'past_due');--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "billing_status" SET DATA TYPE "public"."billing_status" USING "billing_status"::"public"."billing_status";--> statement-breakpoint
DROP INDEX "dashboard_log_view_user_name_uidx";--> statement-breakpoint
DELETE FROM "dashboard_log_view";--> statement-breakpoint
ALTER TABLE "dashboard_log_view" ADD COLUMN "app_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_log_view" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_log_view" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "dashboard_log_view" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_log_view" ADD CONSTRAINT "dashboard_log_view_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_log_view" ADD CONSTRAINT "dashboard_log_view_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_log_view" ADD CONSTRAINT "dashboard_log_view_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_log_view_app_id_idx" ON "dashboard_log_view" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_log_view_app_slug_uidx" ON "dashboard_log_view" USING btree ("app_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_usage_organization_id_uidx" ON "organization_usage" USING btree ("organization_id");
