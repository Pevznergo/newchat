/**
 * Seed script for clan levels
 * Run with: pnpm tsx lib/db/seed-clan-levels.ts
 */

import { db } from ".";
import { clanLevel } from "./schema";

async function seedClanLevels() {
  console.log("🌱 Seeding clan levels...");

  const levels = [
    {
      level: 1,
      minUsers: 1,
      minPro: 0,
      maxFreeToPaidRatio: null,
      weeklyTextCredits: 15,
      weeklyImageGenerations: 1,
      unlimitedModels: [],
      description: "Базовый уровень для всех кланов",
      isEnabled: true,
    },
    {
      level: 2,
      minUsers: 2,
      minPro: 0,
      maxFreeToPaidRatio: null,
      weeklyTextCredits: 30,
      weeklyImageGenerations: 3,
      unlimitedModels: [],
      description: "Небольшой клан с двумя участниками",
      isEnabled: true,
    },
    {
      level: 3,
      minUsers: 6,
      minPro: 1,
      maxFreeToPaidRatio: null,
      weeklyTextCredits: 50,
      weeklyImageGenerations: 5,
      unlimitedModels: [],
      description: "Растущий клан с первым Pro-подписчиком",
      isEnabled: true,
    },
    {
      level: 4,
      minUsers: 10,
      minPro: 2,
      maxFreeToPaidRatio: null,
      weeklyTextCredits: 75,
      weeklyImageGenerations: 5,
      unlimitedModels: [],
      description: "Активный клан с несколькими Pro-подписчиками",
      isEnabled: true,
    },
    {
      level: 5,
      minUsers: 15,
      minPro: 3,
      maxFreeToPaidRatio: 5,
      weeklyTextCredits: 100,
      weeklyImageGenerations: 10,
      unlimitedModels: [
        "model_gpt5nano",
        "model_gemini3flash",
        "model_gpt4omini",
      ],
      description: "Максимальный уровень с безлимитными моделями",
      isEnabled: true,
    },
  ];

  for (const level of levels) {
    await db
      .insert(clanLevel)
      .values(level)
      .onConflictDoUpdate({
        target: clanLevel.level,
        set: {
          minUsers: level.minUsers,
          minPro: level.minPro,
          maxFreeToPaidRatio: level.maxFreeToPaidRatio,
          weeklyTextCredits: level.weeklyTextCredits,
          weeklyImageGenerations: level.weeklyImageGenerations,
          unlimitedModels: level.unlimitedModels,
          description: level.description,
          isEnabled: level.isEnabled,
          updatedAt: new Date(),
        },
      });
  }

  console.log("✅ Seeded 5 clan levels");
}

seedClanLevels()
  .then(() => {
    console.log("✅ Clan levels seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Failed to seed clan levels:", error);
    process.exit(1);
  });
