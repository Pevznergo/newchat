import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const fixSchema = async () => {
	const connectionString = process.env.POSTGRES_URL;
	if (!connectionString) {
		throw new Error("POSTGRES_URL is not defined");
	}

	const sql = postgres(connectionString);

	console.log("🔧 Fixing AiModel schema...");

	try {
		// Add cost
		await sql`ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "cost" integer DEFAULT 1 NOT NULL`;
		console.log("✅ Added cost column");

		// Add is_pro
		await sql`ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "is_pro" boolean DEFAULT false`;
		console.log("✅ Added is_pro column");

		// Add is_enabled (if not exists)
		await sql`ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "is_enabled" boolean DEFAULT true`;
		console.log("✅ Added is_enabled column");

		// Rename provider_id to provider
		// Check if provider_id exists
		const cols =
			await sql`SELECT column_name FROM information_schema.columns WHERE table_name='AiModel' AND column_name='provider_id'`;
		if (cols.length > 0) {
			await sql`ALTER TABLE "AiModel" RENAME COLUMN "provider_id" TO "provider"`;
			console.log("✅ Renamed provider_id to provider");
		}

		// Rename is_active to is_enabled (if is_active exists and is_enabled was just created empty or we want to migrate data)
		// Actually, I added is_enabled above via ADD COLUMN IF NOT EXISTS.
		// If is_active exists, we might want to migrate data or rename it.
		// Schema says "is_enabled". Inspection showed "is_active".
		const activeCols =
			await sql`SELECT column_name FROM information_schema.columns WHERE table_name='AiModel' AND column_name='is_active'`;
		if (activeCols.length > 0) {
			// If is_enabled is empty (all true default), maybe copy from is_active?
			// Or just rename is_active -> is_enabled (but is_enabled might exist now).
			// Let's drop is_enabled if we just added it, and rename is_active.
			// Or cleaner: Update is_enabled from is_active, then drop is_active.
			await sql`UPDATE "AiModel" SET "is_enabled" = "is_active" WHERE "is_active" IS NOT NULL`;
			// We won't drop is_active just in case, but code uses is_enabled.
			console.log("✅ Synced is_active to is_enabled");
		}
	} catch (error) {
		console.error("❌ Fix failed:", error);
	}

	process.exit(0);
};

fixSchema();
