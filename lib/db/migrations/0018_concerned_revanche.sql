-- Manual migration to align with existing 'clans' table and 'User.clan_id' column

-- 1. Update 'clans' table (add missing column)
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;

-- 2. Cleanup User table Constraints FIRST (Before dropping Clan)
DO $$ BEGIN
  ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_clanId_Clan_id_fk";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- 3. Drop phantom 'Clan' table (UUID based)
DROP TABLE IF EXISTS "Clan";

-- 4. Drop phantom 'clanId' (UUID) column if it exists
ALTER TABLE "User" DROP COLUMN IF EXISTS "clanId";

-- 5. Ensure FK exists between User.clan_id (Int) and clans.id (Int)
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
