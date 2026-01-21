"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/drizzle";
import { aiModel, modelLimit } from "@/lib/db/schema";
import redis from "@/lib/redis";

// Cache Keys to invalidate
const PROVIDER_MAP_KEY = "config:provider_map";
const ACTIVE_MODELS_KEY = "config:active_models";
const _LIMITS_KEY_PREFIX = "config:limits:";

async function invalidateConfig() {
  try {
    await redis.del(PROVIDER_MAP_KEY);
    await redis.del(ACTIVE_MODELS_KEY);
    // We can't easily wildcard delete in standard Redis without KEYS/SCAN,
    // but typically we let limits expire or use a version key.
    // For now, let's accept 5 min stale limits or we can implement specific key deletion if we know the modelId.
  } catch (_e) {
    // ignore
  }
}

export async function toggleModelStatus(id: string, isActive: boolean) {
  await db.update(aiModel).set({ isActive }).where(eq(aiModel.id, id));
  await invalidateConfig();
  revalidatePath("/admin/models");
}

export async function saveModel(data: FormData) {
  const id = data.get("id") as string;
  const modelId = data.get("modelId") as string;
  const name = data.get("name") as string;
  const providerId = data.get("providerId") as string;
  const type = data.get("type") as string;
  const description = data.get("description") as string;
  const isPremium = data.get("isPremium") === "on";

  if (id) {
    await db
      .update(aiModel)
      .set({
        modelId,
        name,
        providerId,
        type,
        description,
        isPremium,
        updatedAt: new Date(),
      })
      .where(eq(aiModel.id, id));
  } else {
    await db.insert(aiModel).values({
      modelId,
      name,
      providerId,
      type,
      description,
      isPremium,
    });
  }

  await invalidateConfig();
  revalidatePath("/admin/models");
  if (!id) {
    redirect("/admin/models");
  }
}

export async function saveLimit(data: FormData) {
  const id = data.get("id") as string;
  const modelId = data.get("modelId") as string; // UUID of aiModel
  const userRole = data.get("userRole") as string;
  const limitCount = Number.parseInt(data.get("limitCount") as string, 10);
  const limitPeriod = data.get("limitPeriod") as string;
  // const isActive = data.get("isActive") === "on";

  if (id) {
    await db
      .update(modelLimit)
      .set({
        limitCount,
        limitPeriod,
        updatedAt: new Date(),
      })
      .where(eq(modelLimit.id, id));
  } else {
    await db.insert(modelLimit).values({
      modelId,
      userRole,
      limitCount,
      limitPeriod,
    });
  }

  // Invalidate specific limit cache if we could derive key, or just wait for TTL
  // Ideally we pass modelId string to invalidate key, but here we have UUID.
  // We'd need to fetch model to get modelId string.
  await invalidateConfig();
  revalidatePath(`/admin/models/${data.get("redirectId")}`); // hack to revalidate page
}

export async function deleteLimit(id: string) {
  await db.delete(modelLimit).where(eq(modelLimit.id, id));
  await invalidateConfig();
  // revalidatePath needs to happen in component or here if we know where we are
}
