"use server";

import { revalidatePath } from "next/cache";
import {
  createTelegramUser,
  updateClanName as dbUpdateClanName,
  getClanMemberCounts,
  getClanMembers,
  getUserByTelegramId,
  getUserClan,
} from "@/lib/db/queries";

// Helper to parse initData (basic version)
// In production, you MUST verify the hash with BOT_TOKEN
function parseInitData(initData: string) {
  const q = new URLSearchParams(initData);
  const userStr = q.get("user");
  if (!userStr) {
    return null;
  }
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// Helper to calculate level (Same as in route.ts/plan)
function calculateClanLevel(totalMembers: number, proMembers: number) {
  if (totalMembers >= 15 && proMembers >= 3) {
    return 5;
  }
  if (proMembers >= 2) {
    return 4;
  }
  if (totalMembers >= 10 && proMembers >= 1) {
    return 3;
  }
  if (totalMembers >= 2) {
    return 2;
  }
  return 1;
}

function getNextLevelRequirements(
  level: number,
  totalMembers: number,
  proMembers: number
) {
  if (level >= 5) {
    return "MAX LEVEL";
  }
  if (level === 4) {
    return `Need ${Math.max(0, 15 - totalMembers)} more Users & ${Math.max(0, 3 - proMembers)} more Pro`;
  }
  if (level === 3) {
    return `Need ${Math.max(0, 2 - proMembers)} more Pro Users`;
  } // Lvl 3->4 needs 2 Pro
  if (level === 2) {
    return `Need ${Math.max(0, 10 - totalMembers)} more Users & 1 Pro`;
  }
  if (level === 1) {
    return `Need ${Math.max(0, 2 - totalMembers)} more Users`;
  }
  return "";
}

export async function fetchClanData(initData: string) {
  const telegramUser = parseInitData(initData);

  if (!telegramUser || !telegramUser.id) {
    return { error: "Invalid initData" };
  }

  const telegramId = telegramUser.id.toString();

  // Ensure user exists (Web App might be first contact?)
  // Usually /start creates it, but let's be safe
  let [user] = await getUserByTelegramId(telegramId);

  if (!user) {
    // If user doesn't exist, create them?
    // Or return error. Let's create to be friendly.
    [user] = await createTelegramUser(telegramId, telegramUser.username);
  }

  if (!user) {
    return { error: "User not found" };
  }

  const clanInfo = await getUserClan(user.id);

  if (!clanInfo) {
    return { inClan: false, inviteCode: null }; // Should show Create/Join UI
  }

  const counts = await getClanMemberCounts(clanInfo.id);
  const members = await getClanMembers(clanInfo.id);

  const calculatedLevel = calculateClanLevel(
    counts.totalMembers,
    counts.proMembers
  );
  const nextReq = getNextLevelRequirements(
    calculatedLevel,
    counts.totalMembers,
    counts.proMembers
  );

  return {
    inClan: true,
    clan: {
      ...clanInfo,
      level: calculatedLevel,
      membersCount: counts.totalMembers,
      proMembersCount: counts.proMembers,
      nextLevelRequirements: nextReq,
      nextLevel: Math.min(5, calculatedLevel + 1),
      progress: calculatedLevel === 5 ? 100 : 50, // Simplified progress
      isOwner: clanInfo.role === "owner",
      membersList: members.map((m) => ({
        id: m.id,
        name: m.name || `User ${m.telegramId?.slice(-4) ?? "???"}`,
        role: m.role,
        isPro: m.hasPaid,
      })),
    },
  };
}

export async function updateClanNameAction(initData: string, newName: string) {
  const telegramUser = parseInitData(initData);
  if (!telegramUser || !telegramUser.id) {
    return { success: false, error: "Invalid auth" };
  }

  const [user] = await getUserByTelegramId(telegramUser.id.toString());
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const clanInfo = await getUserClan(user.id);
  if (!clanInfo || clanInfo.role !== "owner") {
    return { success: false, error: "Not owner" };
  }

  await dbUpdateClanName(clanInfo.id, newName);
  revalidatePath("/clan");
  return { success: true };
}
