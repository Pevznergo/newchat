import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type AiModel, aiModel } from "@/lib/db/schema";

/**
 * Unified model cache for all AI models (text, image, video)
 * Auto-refreshes every 5 minutes
 */
type ModelsCache = {
	text: Map<string, AiModel>;
	image: Map<string, AiModel>;
	video: Map<string, AiModel>;
	all: Map<string, AiModel>;
	lastUpdate: number;
};

const modelsCache: ModelsCache = {
	text: new Map(),
	image: new Map(),
	video: new Map(),
	all: new Map(),
	lastUpdate: 0,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all models or filtered by type
 * Automatically refreshes cache if stale
 */
export async function getModels(
	type?: "text" | "image" | "video",
): Promise<Map<string, AiModel>> {
	const now = Date.now();

	// Refresh cache if stale
	if (now - modelsCache.lastUpdate > CACHE_TTL) {
		await refreshModelsCache();
	}

	return type ? modelsCache[type] : modelsCache.all;
}

/**
 * Get a single model by ID
 */
export async function getModel(modelId: string): Promise<AiModel | undefined> {
	const allModels = await getModels();
	return allModels.get(modelId);
}

/**
 * Refresh the models cache from database
 */
async function refreshModelsCache(): Promise<void> {
	const allModels = await db
		.select()
		.from(aiModel)
		.where(eq(aiModel.isEnabled, true));

	// Clear all caches
	modelsCache.text.clear();
	modelsCache.image.clear();
	modelsCache.video.clear();
	modelsCache.all.clear();

	// Populate caches
	for (const model of allModels) {
		modelsCache.all.set(model.modelId, model);

		if (model.type === "text") {
			modelsCache.text.set(model.modelId, model);
		} else if (model.type === "image") {
			modelsCache.image.set(model.modelId, model);
		} else if (model.type === "video") {
			modelsCache.video.set(model.modelId, model);
		}
	}

	modelsCache.lastUpdate = Date.now();

	console.log(
		`[ModelsCache] Refreshed: ${allModels.length} models (${modelsCache.text.size} text, ${modelsCache.image.size} image, ${modelsCache.video.size} video)`,
	);
}

/**
 * Invalidate cache (call after updating models in admin)
 */
export function invalidateModelsCache(): void {
	modelsCache.lastUpdate = 0;
	console.log("[ModelsCache] Cache invalidated");
}

/**
 * Get image models in legacy format for compatibility
 */
export async function getImageModelsLegacy(): Promise<
	Record<
		string,
		{
			id: string;
			name: string;
			provider: string;
			enabled: boolean;
		}
	>
> {
	const imageModels = await getModels("image");
	const result: Record<string, any> = {};

	for (const [modelId, model] of imageModels) {
		result[modelId] = {
			id: model.apiModelId || "",
			name: model.name,
			provider: model.provider,
			enabled: model.isEnabled,
		};
	}

	return result;
}

/**
 * Preload cache on startup (optional)
 */
export async function preloadModelsCache(): Promise<void> {
	await refreshModelsCache();
}
