DROP TABLE IF EXISTS "api_key" CASCADE;
--> statement-breakpoint
DO $$
BEGIN
    CREATE TYPE "public"."ingestion_key_kind" AS ENUM('public', 'private');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
CREATE TABLE "ingestion_key" (
    "id" text PRIMARY KEY NOT NULL,
    "organization_id" text NOT NULL,
    "kind" "ingestion_key_kind" NOT NULL,
    "key" text NOT NULL,
    "created_by" text,
    "last_used_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "revoked_at" timestamp,
    CONSTRAINT "ingestion_key_public_prefix_check" CHECK (("ingestion_key"."kind" <> 'public'::ingestion_key_kind OR "ingestion_key"."key" LIKE 'pk_%')),
    CONSTRAINT "ingestion_key_private_prefix_check" CHECK (("ingestion_key"."kind" <> 'private'::ingestion_key_kind OR "ingestion_key"."key" LIKE 'sk_%'))
);
--> statement-breakpoint
ALTER TABLE "ingestion_key" ADD CONSTRAINT "ingestion_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ingestion_key" ADD CONSTRAINT "ingestion_key_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ingestion_key_organization_id_idx" ON "ingestion_key" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "ingestion_key_created_by_idx" ON "ingestion_key" USING btree ("created_by");
--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_key_key_uidx" ON "ingestion_key" USING btree ("key");
--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_key_one_active_kind_per_org_uidx" ON "ingestion_key" USING btree ("organization_id","kind") WHERE "revoked_at" IS NULL;
