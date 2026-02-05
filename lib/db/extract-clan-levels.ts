import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { clanLevel } from "./schema";

config({ path: ".env.local" });

async function extractFromDB() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("Extracting clan levels from DB...");

  const levels = await db.select().from(clanLevel).orderBy(clanLevel.level);

  console.log("\n=== Current DB Clan Levels ===\n");
  console.log("const LEVELS = [");

  for (const lvl of levels) {
    console.log("  {");
    console.log(`    level: ${lvl.level},`);
    console.log(`    minUsers: ${lvl.minUsers},`);
    console.log(`    minPro: ${lvl.minPro},`);
    console.log(`    weeklyTextCredits: ${lvl.weeklyTextCredits},`);
    console.log(`    weeklyImageGenerations: ${lvl.weeklyImageGenerations},`);
    console.log(`    description: ${JSON.stringify(lvl.description)},`);
    if (lvl.unlimitedModels && lvl.unlimitedModels.length > 0) {
      console.log(
        `    unlimitedModels: ${JSON.stringify(lvl.unlimitedModels)},`
      );
    }
    console.log("  },");
  }

  console.log("];\n");

  await connection.end();
  process.exit(0);
}

extractFromDB().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});
