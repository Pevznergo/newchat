import { sql } from "drizzle-orm";
import { db } from "./lib/db";

async function addDaysOfWeekColumn() {
	console.log("Adding days_of_week column to FollowUpRule table...");

	try {
		await db.execute(
			sql`ALTER TABLE "FollowUpRule" ADD COLUMN IF NOT EXISTS "days_of_week" json;`,
		);
		console.log("✅ Column added successfully!");
	} catch (error) {
		console.error("❌ Failed to add column:", error);
		throw error;
	}
}

addDaysOfWeekColumn()
	.then(() => {
		console.log("Migration completed successfully.");
		process.exit(0);
	})
	.catch((err) => {
		console.error("Migration failed:", err);
		process.exit(1);
	});
