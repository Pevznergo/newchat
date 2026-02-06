CREATE TABLE "cached_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"file_id" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'video',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cached_assets_key_unique" UNIQUE("key")
);
