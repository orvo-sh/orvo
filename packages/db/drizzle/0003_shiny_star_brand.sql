CREATE TYPE "public"."scout_credit_grant_source" AS ENUM('plan', 'purchase', 'adjustment');--> statement-breakpoint
CREATE TABLE "scout_credit_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"source" "scout_credit_grant_source" NOT NULL,
	"source_reference" text NOT NULL,
	"granted_credits" bigint NOT NULL,
	"remaining_credits" bigint NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"app_id" text,
	"chat_id" text,
	"user_id" text,
	"model" text NOT NULL,
	"policy_version" integer NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"credits" bigint NOT NULL,
	"unfunded_credits" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_usage_allocation" (
	"usage_id" text NOT NULL,
	"grant_id" text NOT NULL,
	"credits" bigint NOT NULL,
	CONSTRAINT "scout_usage_allocation_usage_id_grant_id_pk" PRIMARY KEY("usage_id","grant_id")
);
--> statement-breakpoint
ALTER TABLE "scout_credit_grant" ADD CONSTRAINT "scout_credit_grant_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_usage" ADD CONSTRAINT "scout_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_usage" ADD CONSTRAINT "scout_usage_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_usage" ADD CONSTRAINT "scout_usage_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_usage" ADD CONSTRAINT "scout_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_usage_allocation" ADD CONSTRAINT "scout_usage_allocation_usage_id_scout_usage_id_fk" FOREIGN KEY ("usage_id") REFERENCES "public"."scout_usage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_usage_allocation" ADD CONSTRAINT "scout_usage_allocation_grant_id_scout_credit_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."scout_credit_grant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scout_credit_grant_organization_source_reference_uidx" ON "scout_credit_grant" USING btree ("organization_id","source_reference");--> statement-breakpoint
CREATE INDEX "scout_credit_grant_organization_expiry_idx" ON "scout_credit_grant" USING btree ("organization_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scout_usage_operation_id_uidx" ON "scout_usage" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "scout_usage_organization_created_at_idx" ON "scout_usage" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "scout_usage_chat_id_idx" ON "scout_usage" USING btree ("chat_id");