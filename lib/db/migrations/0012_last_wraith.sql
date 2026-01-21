CREATE TABLE IF NOT EXISTS "Tariff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"price_rub" integer NOT NULL,
	"price_stars" integer NOT NULL,
	"duration_days" integer,
	"request_limit" integer,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Tariff_slug_unique" UNIQUE("slug")
);
