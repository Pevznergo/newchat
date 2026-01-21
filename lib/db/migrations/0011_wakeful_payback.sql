CREATE TABLE IF NOT EXISTS "UserConsent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"consent_type" varchar(100) NOT NULL,
	"telegram_id" varchar(32),
	"email" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "request_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "selected_model" varchar(100) DEFAULT 'model_gpt4omini';--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" json;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
