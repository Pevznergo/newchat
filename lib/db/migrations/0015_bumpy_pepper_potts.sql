CREATE TABLE IF NOT EXISTS "AiModel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"cost" integer DEFAULT 1 NOT NULL,
	"is_premium" boolean DEFAULT false,
	"is_pro" boolean DEFAULT false,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "AiModel_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "is_admin" boolean DEFAULT false;