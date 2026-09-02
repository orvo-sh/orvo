CREATE TABLE "slack_oauth_state" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_destination" ADD COLUMN "slack_team_id" text;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD COLUMN "slack_team_name" text;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD COLUMN "slack_channel_id" text;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD COLUMN "slack_channel_name" text;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD COLUMN "slack_webhook_url_encrypted" text;--> statement-breakpoint
ALTER TABLE "slack_oauth_state" ADD CONSTRAINT "slack_oauth_state_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_oauth_state" ADD CONSTRAINT "slack_oauth_state_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_oauth_state" ADD CONSTRAINT "slack_oauth_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slack_oauth_state_expires_at_idx" ON "slack_oauth_state" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_destination_one_slack_per_app_uidx" ON "notification_destination" USING btree ("app_id") WHERE "notification_destination"."slack_team_id" IS NOT NULL;
