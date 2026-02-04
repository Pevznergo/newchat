"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aiModel, clanLevel } from "@/lib/db/schema";

export async function getModels() {
  return await db.select().from(aiModel).orderBy(aiModel.name);
}

export async function upsertModel(data: {
  id?: string;
  modelId: string;
  name: string;
  provider: string;
  type: string;
  cost: number;
  apiModelId?: string;
  requiredClanLevel?: number;
  isEnabled?: boolean;
  description?: string;
}) {
  const payload = {
    modelId: data.modelId,
    name: data.name,
    provider: data.provider,
    type: data.type,
    cost: data.cost,
    apiModelId: data.apiModelId || null,
    requiredClanLevel: data.requiredClanLevel || 1,
    isEnabled: data.isEnabled ?? true,
    description: data.description || null,
    updatedAt: new Date(),
  };

  if (data.id) {
    await db.update(aiModel).set(payload).where(eq(aiModel.id, data.id));
  } else {
    // Check if modelId exists
    const existing = await db.query.aiModel.findFirst({
      where: eq(aiModel.modelId, data.modelId),
    });

    if (existing) {
      throw new Error("Model ID already exists");
    }

    await db.insert(aiModel).values(payload);
  }

  revalidatePath("/admin/models");
}

export async function deleteModel(id: string) {
  await db.delete(aiModel).where(eq(aiModel.id, id));
  revalidatePath("/admin/models");
}

export async function getClanLevels() {
  return await db
    .select()
    .from(clanLevel)
    .orderBy(clanLevel.level as any);
}

export async function upsertClanLevel(data: {
  id: string;
  level: number;
  minUsers: number;
  minPro: number;
  weeklyTextCredits: number;
  weeklyImageGenerations: number;
  description: string;
}) {
  await db
    .update(clanLevel)
    .set({
      minUsers: data.minUsers,
      minPro: data.minPro,
      weeklyTextCredits: data.weeklyTextCredits,
      weeklyImageGenerations: data.weeklyImageGenerations,
      description: data.description,
      updatedAt: new Date(),
    })
    .where(eq(clanLevel.id, data.id));

  revalidatePath("/admin/clans");
}
