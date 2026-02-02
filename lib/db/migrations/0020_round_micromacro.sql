CREATE TABLE "ClanLevel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" integer NOT NULL,
	"min_users" integer DEFAULT 1 NOT NULL,
	"min_pro" integer DEFAULT 0 NOT NULL,
	"max_free_to_paid_ratio" integer,
	"weekly_text_credits" integer DEFAULT 15 NOT NULL,
	"weekly_image_generations" integer DEFAULT 1 NOT NULL,
	"unlimited_models" text[],
	"description" text,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ClanLevel_level_unique" UNIQUE("level")
);
