CREATE TABLE "onboarding" (
	"user_id" text NOT NULL,
	"milestone" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_user_id_milestone_pk" PRIMARY KEY("user_id","milestone")
);
--> statement-breakpoint
ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;