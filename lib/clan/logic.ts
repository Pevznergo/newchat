import { CLAN_LEVELS, type ClanLevelConfig } from "./config";

export function getLevelConfig(level: number): ClanLevelConfig {
  return CLAN_LEVELS[level] || CLAN_LEVELS[1];
}

export function calculateClanLevel(
  totalMembers: number,
  proMembers: number
): number {
  const level = 1;

  // Iterate from Level 5 down to 2. If meets requirements, return that level.
  // Check Level 5
  if (checkRequirements(5, totalMembers, proMembers)) {
    // Check specific L5 ratio rule
    const ratio = totalMembers / (proMembers || 1); // Avoid div 0
    // Max Free:Paid ratio 5:1.
    // Total includes Paid. Free = Total - Paid.
    // Ratio = (Total - Paid) / Paid <= 5.
    const freeMembers = totalMembers - proMembers;
    const currentRatio = freeMembers / (proMembers || 1);

    if (currentRatio <= 5) {
      return 5;
    }
    // If ratio fails, check L4? Yes.
  }

  // Check Level 4
  if (checkRequirements(4, totalMembers, proMembers)) return 4;

  // Check Level 3
  if (checkRequirements(3, totalMembers, proMembers)) return 3;

  // Check Level 2
  if (checkRequirements(2, totalMembers, proMembers)) return 2;

  return 1;
}

function checkRequirements(
  level: number,
  totalMembers: number,
  proMembers: number
) {
  const req = CLAN_LEVELS[level]?.requirements;
  if (!req) return false;
  return totalMembers >= req.minUsers && proMembers >= req.minPro;
}

export function getNextLevelRequirements(
  currentLevel: number,
  totalMembers: number,
  proMembers: number
) {
  if (currentLevel >= 5) return null;

  const nextLevel = currentLevel + 1;
  const req = CLAN_LEVELS[nextLevel].requirements;

  const neededUsers = Math.max(0, req.minUsers - totalMembers);
  const neededPro = Math.max(0, req.minPro - proMembers);

  return {
    nextLevel,
    neededUsers,
    neededPro,
    description: `Level ${nextLevel} needs: ${neededUsers > 0 ? `+${neededUsers} Users` : ""} ${neededPro > 0 ? `+${neededPro} Pro` : ""}`,
  };
}
