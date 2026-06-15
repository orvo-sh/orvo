CREATE TABLE "organization_activation" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"has_viewed_telemetry" boolean DEFAULT false NOT NULL,
	"has_created_first_alert" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_activation" ADD CONSTRAINT "organization_activation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
