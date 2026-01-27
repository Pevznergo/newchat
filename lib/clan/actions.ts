import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clan, user } from "@/lib/db/schema";

export async function createClan(userId: string, name: string) {
  try {
    // Check if user already in clan
    const existingUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { clanId: true },
    });

    if (existingUser?.clanId) {
      return { success: false, error: "already_in_clan" };
    }

    // Check name uniqueness
    const existingName = await db.query.clan.findFirst({
      where: eq(clan.name, name),
    });
    if (existingName) {
      return { success: false, error: "name_taken" };
    }

    const inviteCode =
      "CLAN-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const [newClan] = await db
      .insert(clan)
      .values({
        name,
        inviteCode,
        ownerId: userId,
        level: 1,
      })
      .returning();

    // Update user
    await db
      .update(user)
      .set({
        clanId: newClan.id,
        clanRole: "owner",
      })
      .where(eq(user.id, userId));

    return { success: true, clan: newClan };
  } catch (error) {
    console.error("Create clan failed", error);
    return { success: false, error: "database_error" };
  }
}

export async function joinClan(userId: string, inviteCode: string) {
  try {
    const targetClan = await db.query.clan.findFirst({
      where: eq(clan.inviteCode, inviteCode),
    });

    if (!targetClan) {
      return { success: false, error: "clan_not_found" };
    }

    const existingUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { clanId: true },
    });

    if (existingUser?.clanId) {
      if (existingUser.clanId === targetClan.id) {
        return { success: false, error: "already_in_this_clan" };
      }
      return { success: false, error: "already_in_other_clan" };
    }

    // Update user
    await db
      .update(user)
      .set({
        clanId: targetClan.id,
        clanRole: "member",
      })
      .where(eq(user.id, userId));

    return { success: true, clan: targetClan };
  } catch (error) {
    console.error("Join clan failed", error);
    return { success: false, error: "database_error" };
  }
}

export async function leaveClan(userId: string) {
  try {
    const u = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { clanId: true, clanRole: true },
    });

    if (!u || !u.clanId) return { success: false, error: "not_in_clan" };

    if (u.clanRole === "owner") {
      // Cannot leave if owner (simple logic: transfer or disband first).
      // For MVP: block leaving or auto-disband if 1 member.
      // Check member count
      // If strictly owner, maybe allow disbanding?
      // "Cannot leave as owner. Promote someone else or disband."
      return { success: false, error: "owner_cannot_leave" };
    }

    await db
      .update(user)
      .set({
        clanId: null,
        clanRole: "member", // Reset role? Or keep default.
      })
      .where(eq(user.id, userId));

    return { success: true };
  } catch (error) {
    console.error("Leave clan failed", error);
    return { success: false, error: "database_error" };
  }
}
