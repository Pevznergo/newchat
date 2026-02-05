import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { clanLevel } from "./schema";

config({ path: ".env.local" });

// IMPORTANT: These are the INITIAL values for clan levels
// This seed script uses onConflictDoNothing, so it will ONLY INSERT new levels
// It will NOT overwrite existing data in the database
// This prevents losing manual changes after rebuilds

const LEVELS = [
  {
    level: 1,
    minUsers: 0,
    minPro: 0,
    weeklyTextCredits: 15,
    weeklyImageGenerations: 2,
    description:
      "15 запросов в неделю \nGemini 3 Flash, GPT Images, GPT-4.1, GPT-4o Mini, GPT-5 Nano\n2 генерации изображений",
  },
  {
    level: 2,
    minUsers: 2,
    minPro: 0,
    weeklyTextCredits: 30,
    weeklyImageGenerations: 4,
    description:
      "30 запросов в неделю\nFLUX 2 Pro, GPT-5.2, Nano Banana, OpenAI o3\n4 генерации изображений",
  },
  {
    level: 3,
    minUsers: 7,
    minPro: 0,
    weeklyTextCredits: 50,
    weeklyImageGenerations: 6,
    description:
      "50 запросов в неделю\n6 генераций изображений\nClaude Opus 4.5, Claude 4.5 Sonnet",
  },
  {
    level: 4,
    minUsers: 10,
    minPro: 0,
    weeklyTextCredits: 75,
    weeklyImageGenerations: 8,
    description:
      "75 запросов в неделю\n8 генераций изображений\nGemini 3 Pro, GPT-4o Search",
  },
  {
    level: 5,
    minUsers: 15,
    minPro: 3,
    weeklyTextCredits: 100,
    weeklyImageGenerations: 16,
    description:
      "Безлимит GPT-5 Nano и GPT-4o Mini\n100 запросов в неделю\n10 генераций изображений\nГенерация видео\nSora 2, Veo 3.1, Sora 2 Pro, Veo 3.1 Fast, Nano Banana Pro",
    unlimitedModels: ["model_gpt5nano", "model_gemini25flash"],
  },
];

async function seed() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("Seeding clan levels...");
  console.log(
    "NOTE: Using onConflictDoNothing - will only add new levels, not update existing ones"
  );

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
      .onConflictDoNothing(); // CHANGED: Don't overwrite existing data
  }

  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
