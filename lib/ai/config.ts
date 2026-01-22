import { db } from "@/lib/db/drizzle";
import { aiModel, modelLimit } from "@/lib/db/schema";
import redis from "@/lib/redis";
import { and, eq } from "drizzle-orm";

// Cache Keys
const PROVIDER_MAP_KEY = "config:provider_map";
const ACTIVE_MODELS_KEY = "config:active_models";
const LIMITS_KEY_PREFIX = "config:limits:";

// TTL (seconds)
const CONFIG_TTL = 300; // 5 minutes

export type ModelConfig = {
  modelId: string;
  providerId: string;
  type: string;
  isPremium: boolean;
};

export async function getProviderMap(): Promise<Record<string, string>> {
  try {
    const cached = await redis.get(PROVIDER_MAP_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (_e) {
    console.warn("Redis fetch failed", _e);
  }

  // Fallback / Fetch from DB
  try {
    const models = await db.select().from(aiModel).where(eq(aiModel.isActive, true));
    
    const map: Record<string, string> = {};
    for (const m of models) {
      map[m.modelId] = m.providerId;
    }

    // Cache it
    try {
        await redis.set(PROVIDER_MAP_KEY, JSON.stringify(map), { EX: CONFIG_TTL });
    } catch (_e) {
        // ignore
    }

    return map;
  } catch (e) {
    console.error("Failed to fetch provider map from DB", e);
    return {}; // Return empty or static fallback if we had one?
  }
}

export async function getActiveModels(): Promise<ModelConfig[]> {
     try {
    const cached = await redis.get(ACTIVE_MODELS_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (_e) {
    console.warn("Redis fetch failed", _e);
  }

  try {
    const models = await db.select().from(aiModel).where(eq(aiModel.isActive, true));
    
    const config = models.map(m => ({
        modelId: m.modelId,
        providerId: m.providerId,
        type: m.type,
        isPremium: m.isPremium
    }));

    try {
        await redis.set(ACTIVE_MODELS_KEY, JSON.stringify(config), { EX: CONFIG_TTL });
    } catch (_e) {
        // ignore
    }
    return config;
  } catch (e) {
      console.error("Failed to fetch active models", e);
      return [];
  }
}

export async function getModelLimit(modelId: string, userRole: string) {
    // Limits might be complex to cache individually if we query by (model, role)
    // We can cache all limits? Or per model?
    // Let's cache per (model, role)
    const key = `${LIMITS_KEY_PREFIX}${modelId}:${userRole}`;
    
    try {
        const cached = await redis.get(key);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (_e) {
        // ignore
    }

    // DB Fetch
    try {
        // We need model UUID, but we might only have modelId string (e.g. 'model_gpt4omini')
        // We need lookup.
        // Let's first get model UUID
        const [model] = await db.select({ id: aiModel.id }).from(aiModel).where(eq(aiModel.modelId, modelId));
        
        if (!model) { return null; }

        const [limit] = await db.select()
            .from(modelLimit)
            .where(and(
                eq(modelLimit.modelId, model.id),
                eq(modelLimit.userRole, userRole),
                eq(modelLimit.isActive, true)
            ));
        
        if (limit) {
            try {
                await redis.set(key, JSON.stringify(limit), { EX: CONFIG_TTL });
            } catch (_e) {
                // ignore
            }
            return limit;
        }
        return null;
    } catch (e) {
        console.error("Failed to fetch limit", e);
        return null;
    }
}

// --- Admin Helpers ---

export async function getAllModels() {
    return await db.select().from(aiModel).orderBy(aiModel.name);
}

export async function getModelById(id: string) {
    const [model] = await db.select().from(aiModel).where(eq(aiModel.id, id));
    return model;
}

export async function getModelLimits(modelId: string) {
    return await db.select().from(modelLimit).where(eq(modelLimit.modelId, modelId));
}

// No-op for now, implementation inside Actions or API routes

