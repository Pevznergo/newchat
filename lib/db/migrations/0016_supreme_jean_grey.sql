CREATE TABLE IF NOT EXISTS "Clan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"invite_code" varchar(50) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"ownerId" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Clan_name_unique" UNIQUE("name"),
	CONSTRAINT "Clan_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "clanId" uuid;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "clan_role" varchar DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "weekly_text_usage" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "weekly_image_usage" integer DEFAULT 0;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_clanId_Clan_id_fk" FOREIGN KEY ("clanId") REFERENCES "public"."Clan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
