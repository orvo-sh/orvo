CREATE TABLE "member_app_access" (
	"member_id" text NOT NULL,
	"app_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_app_access_member_id_app_id_pk" PRIMARY KEY("member_id","app_id")
);
--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "app_access_mode" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "app_ids" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "app_access_mode" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_app_access" ADD CONSTRAINT "member_app_access_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_app_access" ADD CONSTRAINT "member_app_access_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;