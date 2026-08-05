CREATE TYPE "public"."chat_context_kind" AS ENUM('trace', 'log', 'metric', 'incident', 'heartbeat');--> statement-breakpoint
CREATE TYPE "public"."chat_message_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TABLE "chat" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"app_id" text NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_context" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"kind" "chat_context_kind" NOT NULL,
	"resource_id" text NOT NULL,
	"label" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"position" integer NOT NULL,
	"role" "chat_message_role" NOT NULL,
	"parts" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_context" ADD CONSTRAINT "chat_context_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_app_id_created_by_updated_at_idx" ON "chat" USING btree ("app_id","created_by","updated_at");--> statement-breakpoint
CREATE INDEX "chat_organization_id_idx" ON "chat" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chat_context_chat_id_idx" ON "chat_context" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_context_chat_kind_resource_uidx" ON "chat_context" USING btree ("chat_id","kind","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_message_chat_id_position_uidx" ON "chat_message" USING btree ("chat_id","position");--> statement-breakpoint
CREATE INDEX "chat_message_chat_id_idx" ON "chat_message" USING btree ("chat_id");