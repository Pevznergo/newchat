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
      description: "Самая мощная модель для сложных задач",
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
      description: "Продвинутая модель для глубоких исследований",
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
      description: "Баланс скорости и интеллекта",
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
      description: "Облегченная версия для быстрых ответов",
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
      description: "Повседневный помощник для простых задач",
    },
    {
      modelId: "model_claude45sonnet",
      name: "Claude 4.5 Sonnet",
      provider: "openrouter",
      type: "text",
      cost: 20,
      apiModelId: "openrouter/anthropic/claude-3.5-sonnet",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Лучшая модель для работы с кодом и текстом",
    },
    {
      modelId: "model_claude45thinking",
      name: "Claude 4.5 Thinking",
      provider: "openrouter",
      type: "text",
      cost: 10,
      apiModelId: "openrouter/anthropic/claude-3.7-sonnet", // API ID stays same (actual model)
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Аналитическое мышление от Anthropic",
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
      description: "Мощная открытая модель для диалогов",
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
      description: "Специализированная модель для рассуждений",
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
      description: "Передовая модель от Google",
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
      description: "Сверхбыстрая обработка больших данных",
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
      description: "Дерзкий и умный ИИ от xAI",
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
      description: "Глубокий анализ и поиск информации",
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
      description: "Поисковая система с ИИ-ответами",
    },
    // Web Search Variants
    {
      modelId: "model_gpt52_web",
      name: "GPT-5.2 (Web)",
      provider: "openai",
      type: "text",
      cost: 10,
      apiModelId: "openai/gpt-5.2-2025-12-11",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "GPT-5.2 с доступом в интернет",
    },
    {
      modelId: "model_claude45sonnet_web",
      name: "Claude 4.5 Sonnet (Web)",
      provider: "openrouter",
      type: "text",
      cost: 10,
      apiModelId: "openrouter/anthropic/claude-3.5-sonnet",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Claude с поиском в реальном времени",
    },
    {
      modelId: "model_gemini_pro_web",
      name: "Gemini 3 Pro (Web)",
      provider: "google",
      type: "text",
      cost: 20,
      apiModelId: "google/gemini-1.5-pro-latest", // Native Google for grounding
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Gemini Pro с актуальными данными",
    },
    {
      modelId: "model_gemini_flash_web",
      name: "Gemini 3 Flash (Web)",
      provider: "google",
      type: "text",
      cost: 8,
      apiModelId: "google/gemini-1.5-flash-latest", // Native Google for grounding
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Быстрый поиск с Gemini Flash",
    },
    {
      modelId: "model_grok41_web",
      name: "Grok 4.1 (Web)",
      provider: "xai",
      type: "text",
      cost: 5,
      apiModelId: "xai/grok-2-vision-1212",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Grok с доступом к новостям X",
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
      description:
        "Передовая модель от Google для продвинутого редактирования изображений",
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
      description: "Продвинутая версия Nano Banana",
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
      description: "Самая художественная нейросеть",
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
      description: "Профессиональная генерация изображений",
    },

    // Video Models (Costs are PER SECOND)
    {
      modelId: "model_video_veo",
      name: "Veo 3.1",
      provider: "google",
      type: "video",
      cost: 10, // ~50 for 5s
      apiModelId: "google/veo", // hypothetical
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Кинематографичное видео от Google",
    },
    {
      modelId: "model_video_veo_fast",
      name: "Veo 3.1 Fast",
      provider: "google",
      type: "video",
      cost: 5, // ~25 for 5s
      apiModelId: "google/veo-fast", // hypothetical
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Быстрая генерация видеоклипов",
    },
    {
      modelId: "model_video_sora",
      name: "Sora 2",
      provider: "openai",
      type: "video",
      cost: 43, // 4s*43 ≈ 172 (Target 170)
      apiModelId: "openai/sora-2",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Революция в генерации видео от OpenAI",
    },
    {
      modelId: "model_video_sora_pro",
      name: "Sora 2 Pro",
      provider: "openai",
      type: "video",
      cost: 213, // 4s*213 ≈ 852 (Target 850)
      apiModelId: "openai/sora-2-pro",
      requiredClanLevel: 1,
      isEnabled: true,
      isPremium: true,
      isPro: false,
      description: "Максимальное качество и реализм",
    },
  ];

  // Insert new models (only if they don't exist)
  console.log("💾 Syncing models (skipping existing)...");
  for (const model of models) {
    await db
      .insert(aiModel)
      .values(model)
      .onConflictDoUpdate({
        target: aiModel.modelId,
        set: {
          name: model.name,
          cost: model.cost,
          description: model.description,
          provider: model.provider,
          type: model.type,
          apiModelId: model.apiModelId,
          requiredClanLevel: model.requiredClanLevel,
          isEnabled: model.isEnabled,
          isPremium: model.isPremium,
          isPro: model.isPro,
        },
      });
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
