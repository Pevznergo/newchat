CREATE TABLE IF NOT EXISTS "AiModel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'text' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "AiModel_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ModelLimit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"user_role" varchar(50) NOT NULL,
	"limit_count" integer NOT NULL,
	"limit_period" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModelLimit" ADD CONSTRAINT "ModelLimit_model_id_AiModel_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."AiModel"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
