import "dotenv/config";
import { db } from "@/lib/db";
import { cachedAssets } from "@/lib/db/schema";

async function main() {
  console.log("Clearing cached_assets table...");
  await db.delete(cachedAssets).execute();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
