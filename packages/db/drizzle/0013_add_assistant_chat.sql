CREATE TABLE "assistant_chat" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"app_id" text NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_message" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"position" integer NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_chat" ADD CONSTRAINT "assistant_chat_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_chat" ADD CONSTRAINT "assistant_chat_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_chat" ADD CONSTRAINT "assistant_chat_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_chat" ADD CONSTRAINT "assistant_chat_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_message" ADD CONSTRAINT "assistant_message_chat_id_assistant_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chat"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "assistant_chat_organization_id_idx" ON "assistant_chat" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "assistant_chat_app_id_idx" ON "assistant_chat" USING btree ("app_id");
--> statement-breakpoint
CREATE INDEX "assistant_chat_created_by_idx" ON "assistant_chat" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "assistant_chat_updated_at_idx" ON "assistant_chat" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "assistant_message_chat_id_idx" ON "assistant_message" USING btree ("chat_id");
--> statement-breakpoint
CREATE INDEX "assistant_message_created_at_idx" ON "assistant_message" USING btree ("created_at");
