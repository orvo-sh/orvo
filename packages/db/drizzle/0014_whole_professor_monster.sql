CREATE TABLE "slack_event" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_link_state" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"slack_user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"app_id" text NOT NULL,
	"event_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_scout_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"thread_ts" text NOT NULL,
	"chat_id" text NOT NULL,
	"app_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_user_link" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"slack_user_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_destination" ADD COLUMN "slack_bot_token_encrypted" text;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD COLUMN "slack_bot_user_id" text;--> statement-breakpoint
ALTER TABLE "notification_destination" ADD COLUMN "slack_scopes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "slack_link_state" ADD CONSTRAINT "slack_link_state_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_link_state" ADD CONSTRAINT "slack_link_state_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_scout_thread" ADD CONSTRAINT "slack_scout_thread_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_scout_thread" ADD CONSTRAINT "slack_scout_thread_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_user_link" ADD CONSTRAINT "slack_user_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slack_event_created_at_idx" ON "slack_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "slack_link_state_expires_at_idx" ON "slack_link_state" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_scout_thread_location_uidx" ON "slack_scout_thread" USING btree ("team_id","channel_id","thread_ts");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_scout_thread_chat_id_uidx" ON "slack_scout_thread" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_user_link_team_user_uidx" ON "slack_user_link" USING btree ("team_id","slack_user_id");--> statement-breakpoint
CREATE INDEX "slack_user_link_user_id_idx" ON "slack_user_link" USING btree ("user_id");
