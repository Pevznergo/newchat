import { config } from "dotenv";

config({ path: ".env.local" });

import { sql } from "drizzle-orm";

import { db } from "./index";

async function main() {
  if (process.env.POSTGRES_URL) {
    try {
      console.log("DB Host:", new URL(process.env.POSTGRES_URL).hostname);
    } catch (e) {
      console.log("DB Host: invalid URL");
    }
  }

  // 1. List all tables
  console.log("Listing tables in public schema:");
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log("Tables:", JSON.stringify(tables, null, 2));

  // 7. Check if clan_id (integer) has data
  console.log("Checking for users with clan_id (INTEGER):");
  const usersWithClanInt = await db.execute(sql`
    SELECT id, clan_id FROM "User" WHERE clan_id IS NOT NULL LIMIT 5
  `);
  console.log("Users with clan_id:", JSON.stringify(usersWithClanInt, null, 2));

  // 8. Check if clanId (UUID) has data
  console.log("Checking for users with clanId (UUID):");
  const usersWithClanUuid = await db.execute(sql`
    SELECT id, "clanId" FROM "User" WHERE "clanId" IS NOT NULL LIMIT 5
  `);
  console.log("Users with clanId:", JSON.stringify(usersWithClanUuid, null, 2));

  // 2. Count in "Clan" (as defined in schema)
  try {
    const countClan = await db.execute(sql`SELECT count(*) FROM "Clan"`);
    console.log('Count in "Clan":', countClan[0].count);
  } catch (e) {
    console.log('Error querying "Clan":', e.message);
  }

  // 3. Count in "clans" (as user mentioned)
  try {
    const countClans = await db.execute(sql`SELECT count(*) FROM "clans"`);
    console.log('Count in "clans":', countClans[0].count);
  } catch (e) {
    console.log('Error querying "clans":', e.message);
  }

  // 4. Count in "clan" (lowercase)
  try {
    const countClansLower = await db.execute(sql`SELECT count(*) FROM "clan"`);
    console.log('Count in "clan":', countClansLower[0].count);
  } catch (e) {
    console.log('Error querying "clan":', e.message);
  }

  // 5. Inspect columns
  console.log("Columns in 'Clan':");
  const colsClan = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Clan'
  `);
  console.log(JSON.stringify(colsClan, null, 2));

  console.log("Columns in 'clans':");
  const colsClans = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'clans'
  `);
  console.log(JSON.stringify(colsClans, null, 2));

  // 6. Inspect User columns
  console.log("Columns in 'User':");
  const colsUser = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'User'
  `);
  console.log(JSON.stringify(colsUser, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
