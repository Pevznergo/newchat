import { CLAN_LEVELS, type ClanLevelConfig } from "./config";

// --- Types ---
// Ideally we reuse DB type, but for now we map DB result to ClanLevelConfig structure locally if needed,
// or just use Any if we are lazy, but let's try to be consistent.
// The DB schema has: minUsers, minPro, weeklyTextCredits, weeklyImageGenerations, description.
// logic.ts expects ClanLevelConfig structure.

export function getLevelConfig(
	level: number,
	dynamicLevels?: any[],
): ClanLevelConfig {
	if (dynamicLevels && dynamicLevels.length > 0) {
		const found = dynamicLevels.find((l) => l.level === level);
		if (found) {
			return {
				requirements: {
					minUsers: found.minUsers,
					minPro: found.minPro,
					maxFreeToPaidRatio: level === 5 ? 5 : undefined, // Logic for L5 ratio is likely custom code, keep it hardcoded or move to DB? "maxFreeToPaidRatio" is not in DB schema yet.
				},
				benefits: {
					weeklyTextCredits: found.weeklyTextCredits,
					weeklyImageGenerations: found.weeklyImageGenerations,
					unlimitedModels:
						level === 5 ? CLAN_LEVELS[5].benefits.unlimitedModels : undefined, // Unlimited models logic also not in DB
				},
			};
		}
	}
	return CLAN_LEVELS[level] || CLAN_LEVELS[1];
}

export function calculateClanLevel(
	totalMembers: number,
	proMembers: number,
	dynamicLevels?: any[],
): number {
	// Use dynamic levels if provided
	const levelsToCheck = [5, 4, 3, 2];

	for (const level of levelsToCheck) {
		if (checkRequirements(level, totalMembers, proMembers, dynamicLevels)) {
			// Special L5 Logic
			if (level === 5) {
				const freeMembers = totalMembers - proMembers;
				const currentRatio = freeMembers / (proMembers || 1);
				if (currentRatio <= 5) {
					return 5;
				}
			} else {
				return level;
			}
		}
	}

	return 1;
}

function checkRequirements(
	level: number,
	totalMembers: number,
	proMembers: number,
	dynamicLevels?: any[],
) {
	let req = CLAN_LEVELS[level]?.requirements;

	// Override with dynamic
	if (dynamicLevels) {
		const found = dynamicLevels.find((l) => l.level === level);
		if (found) {
			req = {
				minUsers: found.minUsers,
				minPro: found.minPro,
				maxFreeToPaidRatio:
					CLAN_LEVELS[level]?.requirements?.maxFreeToPaidRatio,
			};
		}
	}

	if (!req) {
		return false;
	}
	return totalMembers >= req.minUsers && proMembers >= req.minPro;
}

export function getNextLevelRequirements(
	currentLevel: number,
	totalMembers: number,
	proMembers: number,
	dynamicLevels?: any[],
) {
	if (currentLevel >= 5) {
		return null;
	}

	const nextLevel = currentLevel + 1;
	let req = CLAN_LEVELS[nextLevel].requirements;

	if (dynamicLevels) {
		const found = dynamicLevels.find((l) => l.level === nextLevel);
		if (found) {
			req = {
				minUsers: found.minUsers,
				minPro: found.minPro,
				maxFreeToPaidRatio: undefined,
			};
		}
	}

	const neededUsers = Math.max(0, req.minUsers - totalMembers);
	const neededPro = Math.max(0, req.minPro - proMembers);

	return {
		nextLevel,
		neededUsers,
		neededPro,
		description: `Level ${nextLevel} needs: ${neededUsers > 0 ? `+${neededUsers} Users` : ""} ${neededPro > 0 ? `+${neededPro} Pro` : ""}`,
	};
}
