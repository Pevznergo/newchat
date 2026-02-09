CREATE TABLE "cached_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"file_id" varchar(255) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cached_assets_url_unique" UNIQUE("url")
);
