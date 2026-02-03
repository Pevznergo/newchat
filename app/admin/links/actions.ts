"use server";

import { desc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { shortLinks } from "@/lib/db/schema";

export async function getShortLinks(page = 1, limit = 20, search = "") {
  try {
    const offset = (page - 1) * limit;

    // Build where clause
    let filters;
    if (search) {
      filters = or(
        ilike(shortLinks.code, `%${search}%`),
        ilike(shortLinks.stickerTitle, `%${search}%`)
      );
    }

    const data = await db
      .select()
      .from(shortLinks)
      .where(filters)
      .orderBy(desc(shortLinks.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count (approximation or separate query)
    // For simplicity, just return data. Client handles "load more" or simple pagination.
    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch links:", error);
    return { success: false, error: "Failed to fetch links" };
  }
}

export async function createShortLink(data: {
  code: string;
  targetUrl: string;
  stickerTitle?: string;
  stickerFeatures?: string;
  stickerPrizes?: string;
}) {
  try {
    const existing = await db
      .select()
      .from(shortLinks)
      .where(eq(shortLinks.code, data.code))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "Code already exists" };
    }

    await db.insert(shortLinks).values({
      code: data.code,
      targetUrl: data.targetUrl,
      stickerTitle: data.stickerTitle,
      stickerFeatures: data.stickerFeatures,
      stickerPrizes: data.stickerPrizes,
      status: "active",
    });

    revalidatePath("/admin/links");
    return { success: true };
  } catch (error) {
    console.error("Failed to create link:", error);
    return { success: false, error: "Failed to create link" };
  }
}
