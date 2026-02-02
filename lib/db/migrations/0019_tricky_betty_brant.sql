-- ALTER TABLE "User" DROP CONSTRAINT "User_clanId_clans_id_fk";
-- --> statement-breakpoint
-- ALTER TABLE "User" ADD COLUMN "clan_id" integer;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "extra_requests" integer DEFAULT 0;--> statement-breakpoint
-- ALTER TABLE "User" ADD CONSTRAINT "User_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- ALTER TABLE "User" DROP COLUMN "clanId";