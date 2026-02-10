"use server";

import { revalidatePath } from "next/cache";
import {
	calculateClanLevel,
	getNextLevelRequirements as getNextLevelReq,
} from "@/lib/clan/logic";
import {
	createTelegramUser,
	updateClanName as dbUpdateClanName,
	getClanLevels,
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
	const clanLevels = await getClanLevels();

	const calculatedLevel = calculateClanLevel(
		counts.totalMembers,
		counts.proMembers,
		clanLevels,
	);
	const nextReqData = getNextLevelReq(
		calculatedLevel,
		counts.totalMembers,
		counts.proMembers,
		clanLevels,
	);
	const nextReq = nextReqData?.description || "МАКС. УРОВЕНЬ";

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
		clanLevels: clanLevels.map((level: any) => ({
			level: level.level,
			description: level.description,
			minUsers: level.minUsers,
			minPro: level.minPro,
			weeklyTextCredits: level.weeklyTextCredits,
			weeklyImageGenerations: level.weeklyImageGenerations,
			unlimitedModels: level.unlimitedModels,
		})),
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

import { createClan, joinClan } from "@/lib/clan/actions";

export async function createClanAction(initData: string, name: string) {
	const telegramUser = parseInitData(initData);
	if (!telegramUser || !telegramUser.id) {
		return { success: false, error: "Invalid auth" };
	}

	const [user] = await getUserByTelegramId(telegramUser.id.toString());
	if (!user) {
		return { success: false, error: "User not found" };
	}

	const res = await createClan(user.id, name);
	if (res.success) {
		revalidatePath("/clan");
	}
	return res;
}

export async function joinClanAction(initData: string, code: string) {
	const telegramUser = parseInitData(initData);
	if (!telegramUser || !telegramUser.id) {
		return { success: false, error: "Invalid auth" };
	}

	const [user] = await getUserByTelegramId(telegramUser.id.toString());
	if (!user) {
		return { success: false, error: "User not found" };
	}

	const res = await joinClan(user.id, code);
	if (res.success) {
		revalidatePath("/clan");
	}
	return res;
}
