CREATE TABLE "short_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"target_url" varchar(500) NOT NULL,
	"clicks_count" integer DEFAULT 0,
	"sticker_title" varchar(255),
	"sticker_features" varchar(255),
	"sticker_prizes" varchar(255),
	"status" varchar(50) DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "short_links_code_unique" UNIQUE("code")
);