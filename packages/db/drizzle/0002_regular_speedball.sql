CREATE TABLE "agent_enrollment" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"environment" text DEFAULT 'production' NOT NULL,
	"created_by" text,
	"expires_at" timestamp NOT NULL,
	"redeemed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_installation" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"ingestion_key_id" text NOT NULL,
	"host_id" text NOT NULL,
	"host_name" text NOT NULL,
	"operating_system" text NOT NULL,
	"architecture" text NOT NULL,
	"agent_version" text NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_enrollment" ADD CONSTRAINT "agent_enrollment_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_enrollment" ADD CONSTRAINT "agent_enrollment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_installation" ADD CONSTRAINT "agent_installation_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_installation" ADD CONSTRAINT "agent_installation_ingestion_key_id_ingestion_key_id_fk" FOREIGN KEY ("ingestion_key_id") REFERENCES "public"."ingestion_key"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_enrollment_app_id_idx" ON "agent_enrollment" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_enrollment_token_hash_uidx" ON "agent_enrollment" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "agent_installation_app_id_idx" ON "agent_installation" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_installation_ingestion_key_id_uidx" ON "agent_installation" USING btree ("ingestion_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_installation_app_host_uidx" ON "agent_installation" USING btree ("app_id","host_id");