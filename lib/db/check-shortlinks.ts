import { sql } from "drizzle-orm";
import "dotenv/config";
import { db } from "./index";

async function check() {
  try {
    const res = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'short_links';
    `);
    console.log("Columns:", res);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

check();
