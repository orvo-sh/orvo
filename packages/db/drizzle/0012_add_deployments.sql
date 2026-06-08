CREATE TYPE "public"."deployment_status" AS ENUM('pending', 'in_progress', 'succeeded', 'failed', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."deployment_correlation_strategy" AS ENUM('time_window', 'explicit_id', 'service_version');--> statement-breakpoint
CREATE TABLE "deployment" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"service_name" text NOT NULL,
	"environment_name" text NOT NULL,
	"version" text,
	"status" "deployment_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"git_sha" text,
	"git_branch" text,
	"git_repository" text,
	"git_actor" text,
	"commit_message" text,
	"external_url" text,
	"correlation_strategy" "deployment_correlation_strategy" DEFAULT 'time_window' NOT NULL,
	"deployment_id_attribute" text,
	"service_version" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deployment_app_id_idx" ON "deployment" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "deployment_app_started_at_idx" ON "deployment" USING btree ("app_id","started_at");--> statement-breakpoint
CREATE INDEX "deployment_app_service_env_idx" ON "deployment" USING btree ("app_id","service_name","environment_name");--> statement-breakpoint
CREATE INDEX "deployment_app_status_idx" ON "deployment" USING btree ("app_id","status");
