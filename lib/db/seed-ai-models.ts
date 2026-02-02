/**
 * Seed AI models from Telegram bot configuration
 * Run with: pnpm tsx lib/db/seed-ai-models.ts
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aiModel } from "./schema";

config({
  path: ".env.local",
});

async function seedAiModels() {
  if (!process.env.POSTGRES_URL) {
    console.log("⏭️  POSTGRES_URL not defined, cannot seed models");
    process.exit(1);
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("🌱 Seeding AI models from bot configuration...");

  const models = [
    // Text Models
    {
      modelId: "model_gpt52",
      name: "GPT-5.2",
      provider: "openai",
      type: "text",
      cost: 50,
      apiModelId: "openai/gpt-5.2-2025-12-11",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_o3",
      name: "OpenAI o3",
      provider: "openai",
      type: "text",
      cost: 100,
      apiModelId: "openai/o3-deep-research-2025-06-26",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_gpt41",
      name: "GPT-4.1",
      provider: "openai",
      type: "text",
      cost: 30,
      apiModelId: "openai/gpt-4.1-2025-04-14",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_gpt5nano",
      name: "GPT-5 Nano",
      provider: "openai",
      type: "text",
      cost: 1,
      apiModelId: "openai/gpt-5-nano-2025-08-07",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: false,
      isPro: false,
    },
    {
      modelId: "model_gpt4omini",
      name: "GPT-4o Mini",
      provider: "openai",
      type: "text",
      cost: 1,
      apiModelId: "openai/gpt-4o-mini-2024-07-18",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: false,
      isPro: false,
    },
    {
      modelId: "model_claude45sonnet",
      name: "Claude 3.5 Sonnet",
      provider: "openrouter",
      type: "text",
      cost: 20,
      apiModelId: "openrouter/anthropic/claude-3.5-sonnet",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_claude45thinking",
      name: "Claude 3.7 Sonnet Thinking",
      provider: "openrouter",
      type: "text",
      cost: 40,
      apiModelId: "openrouter/anthropic/claude-3.7-sonnet",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_deepseek_v3",
      name: "DeepSeek V3",
      provider: "openrouter",
      type: "text",
      cost: 1,
      apiModelId: "openrouter/deepseek/deepseek-chat",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: false,
      isPro: false,
    },
    {
      modelId: "model_deepseek_r1",
      name: "DeepSeek R1",
      provider: "openrouter",
      type: "text",
      cost: 10,
      apiModelId: "openrouter/deepseek/deepseek-r1",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_gemini_pro",
      name: "Gemini 3 Pro",
      provider: "openrouter",
      type: "text",
      cost: 15,
      apiModelId: "openrouter/google/gemini-pro-1.5",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_gemini_flash",
      name: "Gemini 3 Flash",
      provider: "openrouter",
      type: "text",
      cost: 1,
      apiModelId: "openrouter/google/gemini-3-flash-preview",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: false,
      isPro: false,
    },
    {
      modelId: "model_grok41",
      name: "Grok 4.1",
      provider: "xai",
      type: "text",
      cost: 25,
      apiModelId: "xai/grok-2-vision-1212",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_deepresearch",
      name: "Deep Research",
      provider: "openai",
      type: "text",
      cost: 100,
      apiModelId: "openai/o3-deep-research-2025-06-26",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_perplexity",
      name: "Perplexity",
      provider: "perplexity",
      type: "text",
      cost: 20,
      apiModelId: "perplexity/sonar-pro",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },

    // Image Models
    {
      modelId: "model_image_nano_banana",
      name: "Nano Banana",
      provider: "openai",
      type: "image",
      cost: 1,
      apiModelId: "openai/chatgpt-image-latest",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: false,
      isPro: false,
    },
    {
      modelId: "model_image_banana_pro",
      name: "Nano Banana Pro",
      provider: "openai",
      type: "image",
      cost: 10,
      apiModelId: "openai/dall-e-3",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_image_midjourney",
      name: "Midjourney",
      provider: "other",
      type: "image",
      cost: 20,
      apiModelId: null, // External service
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_image_flux",
      name: "FLUX 2",
      provider: "other",
      type: "image",
      cost: 15,
      apiModelId: null, // External service
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },

    // Video Models
    {
      modelId: "model_video_veo",
      name: "Veo",
      provider: "google",
      type: "video",
      cost: 50,
      apiModelId: null, // External service
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_video_sora",
      name: "Sora",
      provider: "openai",
      type: "video",
      cost: 100,
      apiModelId: null, // External service
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_video_kling",
      name: "Kling",
      provider: "other",
      type: "video",
      cost: 40,
      apiModelId: null, // External service
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_video_pika",
      name: "Pika",
      provider: "other",
      type: "video",
      cost: 30,
      apiModelId: null, // External service
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
    {
      modelId: "model_video_hailuo",
      name: "Hailuo",
      provider: "other",
      type: "video",
      cost: 35,
      apiModelId: null, // External service
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
    },
  ];

  // Clear existing models
  console.log("🗑️  Clearing existing models...");
  await db.delete(aiModel);

  // Insert new models
  console.log("💾 Inserting models...");
  for (const model of models) {
    await db.insert(aiModel).values(model);
  }

  console.log(`✅ Seeded ${models.length} AI models`);

  // Print summary
  const textModels = models.filter((m) => m.type === "text");
  const imageModels = models.filter((m) => m.type === "image");
  const videoModels = models.filter((m) => m.type === "video");

  console.log("\n📊 Summary:");
  console.log(`   💬 Text models: ${textModels.length}`);
  console.log(`   🖼️  Image models: ${imageModels.length}`);
  console.log(`   🎬 Video models: ${videoModels.length}`);
  console.log(
    `\n   🆓 Free models: ${models.filter((m) => !m.isPremium).length}`
  );
  console.log(
    `   ⭐ Premium models: ${models.filter((m) => m.isPremium).length}`
  );
}

seedAiModels()
  .then(() => {
    console.log("\n✅ AI models seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Failed to seed AI models:", error);
    process.exit(1);
  });
