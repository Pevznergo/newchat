import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { clanLevel } from "./schema";

config({ path: ".env.local" });

const LEVELS = [
  {
    level: 1,
    minUsers: 0,
    minPro: 0,
    weeklyTextCredits: 15,
    weeklyImageGenerations: 0,
    description:
      "15 бесплатных запросов / неделю\nДоступ к базовым моделям\n7 цветов для названия клана",
  },
  {
    level: 2,
    minUsers: 2,
    minPro: 0,
    weeklyTextCredits: 30,
    weeklyImageGenerations: 0,
    description:
      "30 бесплатных запросов / неделю\nПриоритетная очередь\n7 цветовых схем для ссылок",
  },
  {
    level: 3,
    minUsers: 10,
    minPro: 1,
    weeklyTextCredits: 50,
    weeklyImageGenerations: 5,
    description:
      "50 бесплатных запросов / неделю\n5 генераций изображений\nПродвинутые модели",
  },
  {
    level: 4,
    minUsers: 0,
    minPro: 2,
    weeklyTextCredits: 75,
    weeklyImageGenerations: 5,
    description:
      "75 бесплатных запросов / неделю\n5 генераций изображений\nПродвинутые модели",
  },
  {
    level: 5,
    minUsers: 15,
    minPro: 3,
    weeklyTextCredits: 100,
    weeklyImageGenerations: 10,
    description:
      "Безлимит GPT-5 Nano/Gemini Flash\n100 запросов в неделю\n10 генераций изображений",
    unlimitedModels: ["model_gpt5nano", "model_gemini25flash"], // Verified IDs
  },
];

async function seed() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("Seeding clan levels...");

  for (const lvl of LEVELS) {
    await db
      .insert(clanLevel)
      .values({
        level: lvl.level,
        minUsers: lvl.minUsers,
        minPro: lvl.minPro,
        weeklyTextCredits: lvl.weeklyTextCredits,
        weeklyImageGenerations: lvl.weeklyImageGenerations,
        description: lvl.description,
        unlimitedModels: lvl.unlimitedModels || [],
        isEnabled: true,
      })
      .onConflictDoUpdate({
        target: clanLevel.level,
        set: {
          minUsers: lvl.minUsers,
          minPro: lvl.minPro,
          weeklyTextCredits: lvl.weeklyTextCredits,
          weeklyImageGenerations: lvl.weeklyImageGenerations,
          description: lvl.description,
          unlimitedModels: lvl.unlimitedModels || [],
          updatedAt: new Date(),
        },
      });
  }

  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
