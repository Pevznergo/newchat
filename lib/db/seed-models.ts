import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { MODEL_COSTS } from "@/lib/ai/cost-models";
import { aiModel } from "./schema";

config({ path: ".env.local" });

const seedModels = async () => {
	const connectionString = process.env.POSTGRES_URL;
	if (!connectionString) {
		throw new Error("POSTGRES_URL is not defined");
	}

	const client = postgres(connectionString, { max: 1 });
	const db = drizzle(client);

	console.log("🌱 Syncing Model Costs...");

	// We iterate over MODEL_COSTS and update the cost in DB where model_id matches
	// Note: MODEL_COSTS keys are IDs like "openai/gpt-4o".
	// The AiModel table has `modelId` column.

	for (const [id, cost] of Object.entries(MODEL_COSTS)) {
		// Upsert model cost
		await db
			.insert(aiModel)
			.values({
				modelId: id,
				name: id.split("/").pop() || id, // Fallback name
				provider: id.split("/")[0] || "unknown",
				type: "text", // Default, we can't fully guess valid type without more info map
				cost,
				isEnabled: true,
			})
			.onConflictDoUpdate({
				target: aiModel.modelId,
				set: { cost },
			});
	}

	console.log("✅ Model costs synced successfully");
	process.exit(0);
};

seedModels().catch((err) => {
	console.error("❌ Model sync failed:", err);
	process.exit(1);
});
