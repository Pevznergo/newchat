import path from "node:path";
import { generateText, tool } from "ai";
import { Bot, InputFile, webhookCallback } from "grammy";
import { z } from "zod";
import {
  CONTEXT_COST_RUBRIC,
  FEATURE_COSTS,
  MODEL_COSTS,
  MODEL_LIMITS,
} from "@/lib/ai/cost-models";
import {
  entitlementsByUserType,
  SUBSCRIPTION_LIMITS,
} from "@/lib/ai/entitlements";
import { IMAGE_MODELS } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createClan, joinClan, leaveClan } from "@/lib/clan/actions";
import { NANO_BANANA_ID } from "@/lib/clan/config";
import {
  calculateClanLevel,
  getLevelConfig,
  getNextLevelRequirements,
} from "@/lib/clan/logic";
import { SCENARIOS } from "@/lib/content/scenarios";
import {
  addExtraRequests,
  cancelUserSubscription,
  consumeExtraRequests,
  createStarSubscription,
  createTelegramUser,
  createUserConsent,
  getAiModels,
  getAllTariffs,
  getChatsByUserId,
  getClanByInviteCode,
  getClanMemberCounts, // added
  getLastActiveSubscription,
  getMessagesByChatId,
  getTariffBySlug,
  getUserByTelegramId,
  getUserClan, // added
  hasUserConsented,
  incrementUserRequestCount,
  incrementWeeklyImageUsage, // added
  incrementWeeklyTextUsage, // added
  saveChat,
  saveMessages,
  setLastMessageId,
  setUserDetails,
  updateUserSelectedModel,
  upsertAiModel,
} from "@/lib/db/queries";
import { createYookassaPayment } from "@/lib/payment";
import { generateUUID } from "@/lib/utils";
import { trackBackendEvent } from "../../../../../lib/mixpanel";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

const bot = new Bot(token);

export const maxDuration = 60;

// --- Constants & Helpers ---

const FREE_MODELS = [
  "model_gpt5nano",
  "model_gpt4omini",
  "model_gemini_flash",
  "model_image_nano_banana",
  "model_deepseek_v3",
];

const MODEL_NAMES: Record<string, string> = {
  model_gpt52: "GPT-5.2",
  model_o3: "OpenAI o3",
  model_gpt41: "GPT-4.1",
  model_gpt5nano: "GPT-5 Nano",
  model_gpt4omini: "GPT-4o Mini",
  model_claude45sonnet: "Claude 3.5 Sonnet",
  model_claude45thinking: "Claude 3.7 Sonnet Thinking",
  model_deepseek_v3: "DeepSeek V3",
  model_deepseek_r1: "DeepSeek R1",
  model_gemini_pro: "Gemini 3 Pro",
  model_gemini_flash: "Gemini 3 Flash",
  model_grok41: "Grok 4.1",
  model_deepresearch: "Deep Research",
  model_perplexity: "Perplexity",
  model_image_nano_banana: "Nano Banana",
  model_image_banana_pro: "Nano Banana Pro",
  model_image_midjourney: "Midjourney",
  model_image_flux: "FLUX 2",
  model_video_veo: "Veo",
  model_video_sora: "Sora",
  model_video_kling: "Kling",
  model_video_pika: "Pika",
  model_video_hailuo: "Hailuo",
};

const PROVIDER_MAP: Record<string, string> = {
  model_gpt52: "openai/gpt-5.2-2025-12-11",
  model_o3: "openai/o3-deep-research-2025-06-26",
  model_gpt41: "openai/gpt-4.1-2025-04-14",
  model_gpt5nano: "openai/gpt-5-nano-2025-08-07",
  model_gpt4omini: "openai/gpt-4o-mini-2024-07-18",
  model_claude45sonnet: "openrouter/anthropic/claude-3.5-sonnet",
  model_claude45thinking: "openrouter/anthropic/claude-3.7-sonnet",
  model_deepseek_v3: "openrouter/deepseek/deepseek-chat",
  model_deepseek_r1: "openrouter/deepseek/deepseek-r1",
  model_gemini_pro: "openrouter/google/gemini-pro-1.5",
  model_gemini_flash: "openrouter/google/gemini-3-flash-preview",
  model_grok41: "xai/grok-2-vision-1212",
  model_deepresearch: "openai/o3-deep-research-2025-06-26",
  model_perplexity: "perplexity/sonar-pro",
  // Image/Video models
  model_image_nano_banana: "openai/chatgpt-image-latest",
  model_image_banana_pro: "openai/dall-e-3",
  model_image_midjourney: "openai/gpt-4o",
  model_image_flux: "openai/gpt-4o",
  model_video_veo: "openai/gpt-4o",
  model_video_sora: "openai/gpt-4o",
  model_video_kling: "openai/gpt-4o",
  model_video_pika: "openai/gpt-4o",
  model_video_hailuo: "openai/gpt-4o",
};

function getModelKeyboard(
  selectedModel: string,
  isPremium: boolean,
  clanLevel = 1
) {
  const config = getLevelConfig(clanLevel);
  const unlimitedModels = config.benefits.unlimitedModels || [];

  const getLabel = (id: string, name: string) => {
    let prefix = "";
    let suffix = "";

    // Status
    if (selectedModel === id) {
      prefix = "✅ ";
    } else if (!isPremium && !unlimitedModels.includes(id)) {
      // Not selected, Not Premium, Not Unlimited in Clan
      // Show Cost
      const cost = MODEL_COSTS[id] || 1;
      suffix = ` (💰${cost})`;
    } else if (!isPremium && unlimitedModels.includes(id)) {
      // Free via Clan
      prefix = "🏰 ";
      suffix = " (Free)";
    }

    return `${prefix}${name}${suffix}`;
  };

  return {
    inline_keyboard: [
      [
        {
          text: getLabel("model_gpt52", "GPT-5.2"),
          callback_data: "model_gpt52",
        },
        {
          text: getLabel("model_o3", "OpenAI o3"),
          callback_data: "model_o3",
        },
        {
          text: getLabel("model_gpt41", "GPT-4.1"),
          callback_data: "model_gpt41",
        },
      ],
      [
        {
          text: getLabel("model_gpt5nano", "GPT-5 Nano"),
          callback_data: "model_gpt5nano",
        },
        {
          text: getLabel("model_gpt4omini", "GPT-4o mini"),
          callback_data: "model_gpt4omini",
        },
      ],
      [
        {
          text: getLabel("model_claude45sonnet", "Claude 4.5 Sonnet"),
          callback_data: "model_claude45sonnet",
        },
        {
          text: getLabel("model_claude45thinking", "Claude 4.5 Thinking"),
          callback_data: "model_claude45thinking",
        },
      ],
      [
        {
          text: getLabel("model_gemini_pro", "Gemini 3 Pro"),
          callback_data: "model_gemini_pro",
        },
        {
          text: getLabel("model_gemini_flash", "Gemini 3 Flash"),
          callback_data: "model_gemini_flash",
        },
      ],
      [
        {
          text: getLabel("model_deepseek_v3", "DeepSeek V3"),
          callback_data: "model_deepseek_v3",
        },
        {
          text: getLabel("model_deepseek_r1", "DeepSeek R1"),
          callback_data: "model_deepseek_r1",
        },
      ],
      [
        {
          text: "🔙 Назад",
          callback_data: "menu_start", // or delete message
        },
      ],
    ],
  };
}

function getImageModelKeyboard(
  selectedModel: string | undefined,
  isPremium: boolean
) {
  const buttons = Object.entries(IMAGE_MODELS).map(([key, model]) => {
    const isSelected = selectedModel === key;
    const isLocked = !isPremium && !FREE_MODELS.includes(key);
    const status = isLocked ? "🔒" : isSelected ? "✅" : "";

    return [
      {
        text: `${status} ${model.name}`,
        callback_data: key,
      },
    ];
  });

  buttons.push([{ text: "🔙 Назад", callback_data: "menu_start" }]);

  return { inline_keyboard: buttons };
}

function getVideoModelKeyboard(selectedModel: string, isPremium: boolean) {
  const isSelected = (id: string) => (selectedModel === id ? "✅ " : "");
  const isLocked = (id: string) =>
    !isPremium && !FREE_MODELS.includes(id) ? "🔒 " : "";
  const getLabel = (id: string, name: string) =>
    `${isLocked(id)}${isSelected(id)}${name}`;

  return {
    inline_keyboard: [
      [
        {
          text: getLabel("model_video_veo", "🪼 Veo 3.1"),
          callback_data: "model_video_veo",
        },
        {
          text: getLabel("model_video_sora", "☁️ Sora 2"),
          callback_data: "model_video_sora",
        },
      ],
      [
        {
          text: getLabel("model_video_kling", "🐼 Kling"),
          callback_data: "model_video_kling",
        },
        {
          text: getLabel("model_video_pika", "🐰 Pika"),
          callback_data: "model_video_pika",
        },
      ],
      [
        {
          text: getLabel("model_video_hailuo", "🦊 Hailuo"),
          callback_data: "model_video_hailuo",
        },
      ],
      [{ text: "Закрыть", callback_data: "menu_close" }],
    ],
  };
}

function getSearchModelKeyboard(selectedModel: string, isPremium: boolean) {
  const isSelected = (id: string) => (selectedModel === id ? "✅ " : "");
  const isLocked = (id: string) =>
    !isPremium && !FREE_MODELS.includes(id) ? "🔒 " : "";
  const getLabel = (id: string, name: string) =>
    `${isLocked(id)}${isSelected(id)}${name}`;

  return {
    inline_keyboard: [
      [
        {
          text: getLabel("model_perplexity", "Perplexity"),
          callback_data: "model_perplexity",
        },
        {
          text: getLabel("model_gpt52", "GPT 5.2"),
          callback_data: "model_gpt52",
        },
        {
          text: getLabel("model_claude45sonnet", "Claude 4.5"),
          callback_data: "model_claude45sonnet",
        },
      ],
      [
        {
          text: getLabel("model_gemini_pro", "Gemini 3 Pro"),
          callback_data: "model_gemini_pro",
        },
        {
          text: getLabel("model_gemini_flash", "Gemini 3 Flash"),
          callback_data: "model_gemini_flash",
        },
      ],
      [
        {
          text: getLabel("model_grok41", "Grok 4.1"),
          callback_data: "model_grok41",
        },
        {
          text: getLabel("model_deepresearch", "Deep Research"),
          callback_data: "model_deepresearch",
        },
        { text: "Закрыть", callback_data: "menu_close" },
      ],
    ],
  };
}

function getPremiumKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "💎 Premium", callback_data: "open_premium_subs" }],
      [{ text: "📦 Пакеты запросов", callback_data: "open_packets" }],
      [{ text: "👥 Клан PRO", callback_data: "open_clan_pro" }],
      [{ text: "💬 Проблемы с оплатой", url: "https://t.me/GoPevzner" }],
    ],
  };
}

async function getSubscriptionKeyboard(plan: "premium" | "premium_x2") {
  const allTariffs = await getAllTariffs();

  // Dictionary to store prices: { "1": price, "3": price }
  const prices: Record<string, number> = {};

  // Filter tariffs for this plan type
  // Slug format: premium_1, premium_3, premium_x2_1, etc.
  // Note: premium_x2_1 starts with premium_ but we need to distinguish
  const prefix = `${plan}_`;

  for (const t of allTariffs) {
    if (t.slug.startsWith(prefix)) {
      // Correctly filter out "premium_x2" if we are looking for just "premium"
      if (plan === "premium" && t.slug.includes("premium_x2")) {
        continue;
      }

      // Extract months from slug end
      const parts = t.slug.split("_");
      const months = parts.at(-1);
      if (months) {
        prices[months] = t.priceRub;
      }
    }
  }

  // Helpers to get price safely
  const p1 = prices["1"] || 0;
  const p3 = prices["3"] || 0;
  const p6 = prices["6"] || 0;
  const p12 = prices["12"] || 0;

  return {
    inline_keyboard: [
      [
        {
          text: `1 месяц – ${p1}₽`,
          callback_data: `pay_${plan}_1`,
        },
      ],
      [
        {
          text: `3 месяца – ${p3}₽ (-20%)`,
          callback_data: `pay_${plan}_3`,
        },
      ],
      [
        {
          text: `6 месяцев – ${p6}₽ (-35%)`,
          callback_data: `pay_${plan}_6`,
        },
      ],
      [
        {
          text: `12 месяцев – ${p12}₽ (-50%)`,
          callback_data: `pay_${plan}_12`,
        },
      ],
      [{ text: "🔙 Назад", callback_data: "premium_back" }],
    ],
  };
}

function getMusicGenerationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🥁 Простой", callback_data: "music_mode_simple" },
        { text: "🎸 Расширенный", callback_data: "music_mode_advanced" },
      ],
      [{ text: "Закрыть", callback_data: "menu_close" }],
    ],
  };
}

// --- Constants & Helpers ---

async function safeAnswerCallbackQuery(ctx: any, text?: string, options?: any) {
  try {
    await ctx.answerCallbackQuery(text, options);
  } catch (error: any) {
    const msg = error?.message || "";
    if (
      msg.includes("query is too old") ||
      msg.includes("query ID is invalid")
    ) {
      // Ignore these specific errors
      console.warn("Suppressed answerCallbackQuery error:", msg);
    } else {
      console.error("answerCallbackQuery failed:", error);
    }
  }
}

// --- Menu Helpers ---

// --- Global Cache for Models ---
let CACHED_MODELS: any[] | null = null;
let CACHE_TIMESTAMP = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function ensureModelsLoaded() {
  const now = Date.now();
  if (!CACHED_MODELS || now - CACHE_TIMESTAMP > CACHE_TTL) {
    try {
      CACHED_MODELS = await getAiModels();
      CACHE_TIMESTAMP = now;
    } catch (e) {
      console.error("Failed to load models for cache", e);
      // Fallback: don't crash, just use hardcoded defaults if possible or empty
    }
  }
}

// --- Cost & Limit Helpers ---

async function calculateRequestCost(
  modelId: string,
  contextLength = 0,
  _videoDurationSec = 0,
  _isEditing = false
): Promise<number> {
  await ensureModelsLoaded();

  // Find in DB cache
  const dbModel = CACHED_MODELS?.find((m) => m.modelId === modelId);

  let finalCost = dbModel ? dbModel.cost : MODEL_COSTS[modelId] || 1;

  // Heuristic for Feature/Special costs if not found in DB or using FEATURE_COSTS directly
  // logic: if modelId is a "feature key" like "image_recognition", logic below handles it?

  // Context Length Multiplier for Text Models
  if (contextLength > CONTEXT_COST_RUBRIC.threshold) {
    const extraBlocks = Math.ceil(
      (contextLength - CONTEXT_COST_RUBRIC.threshold) / CONTEXT_COST_RUBRIC.step
    );
    // "For 6001-12000 will be x2, 12001-18000 x3"
    // If base is 1, and we have 1 block over, we want x2.
    // logic: multiplier = 1 + extraBlocks
    const multiplier = CONTEXT_COST_RUBRIC.baseMultiplier + extraBlocks;
    finalCost *= multiplier;
  }

  // Video/Image Special Logic overrides
  // (Ideally precise logic maps specific internal model IDs to cost features)

  return finalCost;
}

// Check if user's clan meets model's clan level requirement
async function checkClanLevelRequirement(
  ctx: any,
  user: any,
  modelId: string
): Promise<boolean> {
  // Premium users bypass clan level requirement
  if (user.hasPaid) {
    return true;
  }

  const dbModel = CACHED_MODELS?.find((m) => m.modelId === modelId);
  const requiredLevel = dbModel?.requiredClanLevel || 1;

  if (requiredLevel <= 1) {
    return true; // No special requirement
  }

  const clanData = await getUserClan(user.id);
  if (!clanData) {
    // User not in clan, but model requires clan level > 1
    await ctx.reply(
      `🔒 Эта модель требует клан уровня ${requiredLevel}.\n\nСоздайте или вступите в клан, чтобы получить доступ!\nИли перейдите на Премиум.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🏰 Мой Клан",
                web_app: { url: "https://aporto.tech/app" },
              },
              {
                text: "⭐ Премиум",
                callback_data: "premium_menu",
              },
            ],
          ],
        },
      }
    );
    return false;
  }

  const counts = await getClanMemberCounts(clanData.id);
  const clanLevel = calculateClanLevel(counts.totalMembers, counts.proMembers);

  if (clanLevel < requiredLevel) {
    await ctx.reply(
      `🔒 Эта модель требует клан уровня ${requiredLevel}, а у вас уровень ${clanLevel}.\n\nПовысьте уровень клана, чтобы отправить запрос.\nИли перейдите на Премиум.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🏰 Мой Клан",
                web_app: { url: "https://aporto.tech/app" },
              },
              {
                text: "⭐ Премиум",
                callback_data: "premium_menu",
              },
            ],
          ],
        },
      }
    );
    return false;
  }

  return true;
}

// Check limits and return true if allowed, false if blocked (and sends message)
async function checkAndEnforceLimits(
  ctx: any,
  user: any,
  cost: number,
  modelId?: string
): Promise<boolean> {
  let limit = 0;
  let currentUsage = 0;
  let isUnlimited = false;
  let effectiveCost = cost;

  // Determine if image request based on modelId or cost logic?
  // Ideally passed modelId helps.
  // We can assume image if cost > some threshold OR check known IDs?
  // Better: check model type if possible. But we don't have dbModel here easily.
  // Quick hack: NANO_BANANA_ID or other image models.
  // For now, let's track separately.
  // We need to know if it's image to check image usage.
  const isImage =
    modelId === NANO_BANANA_ID ||
    modelId?.includes("image") ||
    modelId?.includes("midjourney") ||
    modelId?.includes("ideogram");

  if (user.hasPaid) {
    // 1. Paid User Logic
    limit = 3000; // Default Premium
    // Try to find tariff limit.
    // Ideally we fetch subscription -> tariff -> requestLimit.
    // For MVP, we use hardcoded 3000/6000 logic or simply fetch User.requestCount < User.limit ?
    // But User table doesn't have custom limit column.
    // Let's rely on checking `user.balance`? No, using credits.
    // Actually, plan says: "Use Tariff Limit (3000/6000)".
    // We assume 3000 unless we detect 'premium_x2' in tariff slug?
    // Since we don't have tariff slug readily available on `user`, we might need a query `getLastActiveSubscription`.
    // Existing code has `getLastActiveSubscription`.
    const sub = await getLastActiveSubscription(user.id);
    if (sub?.tariffSlug.includes("x2")) {
      limit = 6000;
    }

    currentUsage = user.requestCount || 0; // Usage is stored in requestCount for Paid? Yes.
  } else {
    // 2. Free User Logic
    if (
      modelId &&
      (modelId.includes("video") ||
        modelId.includes("sora") ||
        modelId.includes("kling"))
    ) {
      await ctx.reply("🔒 Видео-модели доступны только в Premium подписке.");
      return false;
    }

    const clanData = await getUserClan(user.id);
    let clanLevel = 1;

    if (clanData) {
      const counts = await getClanMemberCounts(clanData.id);
      clanLevel = calculateClanLevel(counts.totalMembers, counts.proMembers);
    }

    const config = getLevelConfig(clanLevel);

    if (isImage) {
      limit = config.benefits.weeklyImageGenerations * 15; // Convert image limit to "Credits" or just Count?
      // Plan: "Weekly Image Limits: 3 Gen".
      // User table has `weeklyImageUsage`.
      // We count Items, not Cost? "3 Gen".
      // Let's use `weeklyImageUsage` as count.
      limit = config.benefits.weeklyImageGenerations;
      currentUsage = user.weeklyImageUsage || 0;
      effectiveCost = 1; // 1 generation
    } else {
      // Text
      limit = config.benefits.weeklyTextCredits;
      currentUsage = user.weeklyTextUsage || 0;

      // Check L5 Unlimited
      if (
        clanLevel === 5 &&
        config.benefits.unlimitedModels?.includes(modelId || "")
      ) {
        isUnlimited = true;
        effectiveCost = 0;
      }
    }
  }

  // Check Limit
  if (!isUnlimited && currentUsage + effectiveCost > limit) {
    // Try to consume from extraRequests
    const consumed = await consumeExtraRequests(user.id, effectiveCost);
    if (consumed) {
      // Consumed from extra pack, allow proceed
      return true;
    }

    let message = "";
    let buttons: any[] = [];

    if (user.hasPaid) {
      // Paid User Reached Limit
      message = `⚡️ <b>Лимит тарифа исчерпан! (${limit})</b>\n\nДокупите пакет запросов, чтобы продолжить.`;
      buttons = [
        [{ text: "📦 Купить запросы", callback_data: "open_packets" }],
      ];
    } else {
      // Free User Logic & Upsell
      const clanData = await getUserClan(user.id);
      message =
        "🛑 <b>Лимиты на эту неделю исчерпаны.</b>\n\nДля увеличения перейдите на Pro или докупите запросы.";

      if (clanData) {
        buttons = [
          [{ text: "💎 Pro (400₽)", callback_data: "open_premium" }],
          [{ text: "📦 Купить запросы", callback_data: "open_packets" }],
          [
            {
              text: "🏰 Мой Клан",
              web_app: { url: "https://aporto.tech/app" },
            },
          ],
        ];
      } else {
        buttons = [
          [{ text: "💎 Pro (400₽)", callback_data: "open_premium" }],
          [{ text: "📦 Купить запросы", callback_data: "open_packets" }],
          [
            {
              text: "🛡 Найти / Создать Клан",
              web_app: { url: "https://aporto.tech/app" },
            },
          ],
        ];
      }
    }

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
    return false;
  }

  // Increment Usage - MOVED TO HANDLERS TO AVOID DOUBLE COUNTING
  // Logic: checkAndEnforceLimits should only CHECK.
  // The caller is responsible for calling increment functions upon success.
  // BUT: logic was mixed. Now we rely on checkAndEnforceLimits doing the check,
  // and we MUST ensure the caller increments.
  //
  // WAIT: If I remove it here, I need to add it consistently everywhere else.
  // The user reported "Double Charge".
  // ONE charge was likely here.
  // THE OTHER charge was likely in the handler (e.g. handleTextMessage line ~2678).
  //
  // FIX: I will KEEP it here (centralized) and REMOVE it from handlers.
  // This is safer to ensure all paths are counted.
  //
  // Correction: The user complained about double charge.
  // I removed the one in `handleTextMessage` (lines ~2678) in the previous step.
  // So this one SHOULD STAY to ensure we charge at least once.
  //
  // However, `checkAndEnforceLimits` is called BEFORE generation.
  // If generation fails, user is charged?
  // Ideally we charge AFTER generation.
  // But strictly speaking, for "Access Control", we often deduct first or reserve.
  // Given complexity, I will KEEP it here for now as the "Source of Truth" for charging,
  // and ensure NO other places charge.

  // Increment Usage
  if (user.hasPaid) {
    // Paid uses requestCount
    await incrementUserRequestCount(user.id, effectiveCost);
  } else if (isImage) {
    await incrementWeeklyImageUsage(user.id, 1);
  } else if (effectiveCost > 0) {
    await incrementWeeklyTextUsage(user.id, effectiveCost);
  }

  return true;
}

function getPaymentMethodKeyboard(payUrl: string) {
  return {
    inline_keyboard: [
      [{ text: "Карта 💳", url: payUrl }],
      [{ text: "СБП 🏛", url: payUrl }],
      // Optional: Add stars payment if desired, but user request specifically mentioned SBP/Card leading to gateway.
      // Re-reading user request: "и кнопки с выбором формы оплаты - СБП или По карте, которые ведут в наш платежный шлюз"
      [{ text: "🔙 Назад", callback_data: "buy_midjourney" }],
    ],
  };
}

async function showModelMenu(ctx: any, user: any) {
  const currentModel = user?.selectedModel || "model_gpt4omini";

  const modelInfo = `В боте доступны ведущие модели ChatGPT, Claude, Gemini и DeepSeek:

⭐️ GPT-5.2 — новая топ-модель OpenAI
🔥 GPT-4.1 — универсальная модель
✔️ GPT-5 mini — быстрая модель
🍓 OpenAI o3 — рассуждающая модель

🚀 Claude 4.5 Sonnet — для кодинга
💬 Claude 4.5 Thinking — рассуждающий режим

🐼 DeepSeek-V3.2 — текстовая модель
🐳 DeepSeek-V3.2 Thinking — для сложных задач

🤖 Gemini 3 Pro — топ-модель Google
⚡️ Gemini 3 Flash — быстрая модель

GPT-5 mini, Gemini 3 Flash и DeepSeek доступны бесплатно`;

  await ctx.reply(modelInfo, {
    reply_markup: getModelKeyboard(currentModel, user?.hasPaid),
  });
}

async function showImageMenu(ctx: any, user: any) {
  const hasConsented = await hasUserConsented(user.id, "image_generation");

  if (!hasConsented) {
    const termsText = `Вы переходите в раздел редактирования изображений.

Запрещается:
• загружать обнаженные фото
• использовать для провокации, обмана, шантажа

Продолжая, вы соглашаетесь с условиями использования сервиса.`;

    await ctx.reply(termsText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Соглашаюсь с условиями",
              callback_data: "confirm_terms_image",
            },
          ],
        ],
      },
    });
    return;
  }

  const currentModel = user.selectedModel?.startsWith("model_image_")
    ? user.selectedModel
    : undefined;

  await ctx.reply("Выберите модель для создания изображений:", {
    reply_markup: getImageModelKeyboard(currentModel, user?.hasPaid),
  });
}

async function showSearchMenu(ctx: any, user: any) {
  const currentModel = user?.selectedModel || "model_gemini_flash"; // Default to free model

  const searchText = `Выберите модель поиска или оставьте выбранную модель по-умолчанию

ℹ️ Режим Deep Research готовит детально проработанные ответы, поэтому занимает больше времени

Чтобы начать поиск отправьте в чат ваш запрос 👇`;

  await ctx.reply(searchText, {
    reply_markup: getSearchModelKeyboard(currentModel, !!user.hasPaid),
  });
}

async function showVideoMenu(ctx: any, user: any) {
  const currentModel = user?.selectedModel?.startsWith("model_video_")
    ? user.selectedModel
    : "model_video_veo";

  const videoMenuText = `Выберите сервис для создания ролика:

🎬 Veo 3.1, Sora 2, Kling, Pika и Hailuo создают видео по описанию или изображению`;

  await ctx.reply(videoMenuText, {
    reply_markup: getVideoModelKeyboard(currentModel, user?.hasPaid),
  });
}

async function showMusicMenu(ctx: any) {
  const musicMenuText = `Выберите режим генерации песни:

🥁 Простой режим — опишите о чем песня
🎸 Расширенный — свой текст и жанр`;

  await ctx.reply(musicMenuText, {
    reply_markup: getMusicGenerationKeyboard(),
  });
}

const PREMIUM_MENU_TEXT = `🚀 <b>PREMIUM PRO</b>
Один доступ — все нейросети мира у тебя в кармане.

Что внутри:
✅ <b>ПОЛНЫЙ ФАРШ:</b> GPT-5.2, Claude 4.5, Gemini 3 Pro, DeepSeek R1.
✅ <b>ГРАФИКА:</b> Midjourney, FLUX 2 и Nano Banana Pro.
✅ <b>КИНОСТУДИЯ:</b> Создание видео в Sora 2, Kling, Veo 3.1 и Hailuo.
✅ <b>УМНЫЙ ПОИСК:</b> Доступ в интернет через Perplexity и OpenAI o3.

<b>Лимиты:</b>
В подписку включено 1500 универсальных запросов на месяц. Этого объема более чем достаточно для активной работы, создания десятков фото и видео.

💰 <b>ЦЕНА: 400 ₽ / мес</b>
(Дешевле двух чашек кофе!)

👥 <b>В КЛАНЕ PRO:</b> от 238 ₽ за аккаунт
🚀 Объединяйтесь до 15 человек — это самая выгодная цена на рынке.`;

async function showPremiumMenu(ctx: any) {
  await ctx.reply(PREMIUM_MENU_TEXT, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: getPremiumKeyboard(),
  });
}

// --- Profile Helpers ---

function getProfileKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🚀 Подключить Премиум", callback_data: "open_premium" }],
      [{ text: "🔙 Назад", callback_data: "menu_start" }],
    ],
  };
}

async function showAccountInfo(ctx: any, user: any) {
  const isPremium = !!user.hasPaid;
  // New Credit System Logic
  let usageText = "";
  let clanInfoText = "";

  // Get Plan Name
  let planName = isPremium ? "Премиум 🚀" : "Стандартный";

  if (isPremium) {
    // Paid: Track credits (requestCount) vs Subscription Limit (Default 3000)
    const sub = await getLastActiveSubscription(user.id);
    const limit = sub?.tariffSlug.includes("x2") ? 6000 : 3000;
    const used = user.requestCount || 0;
    usageText = `${used}/${limit} кредитов`;

    if (user.selectedModel?.includes("video")) {
      usageText += "\n(Видео: отдельные пакеты)";
    }
  } else {
    // Free: Track weekly text usage vs Clan Level Limit
    const clanData = await getUserClan(user.id);
    let clanLevel = 1;
    let role = "";

    if (clanData) {
      // Need to calculate current level dynamically or trust DB?
      // DB `clan.level` field exists. Ideally we update it periodically?
      // Or calculate on fly.
      // Plan says "Progression based on members".
      // Let's calculate on fly to be accurate.
      const counts = await getClanMemberCounts(clanData.id);
      clanLevel = calculateClanLevel(counts.totalMembers, counts.proMembers);
      role =
        clanData.role === "owner"
          ? "Глава"
          : clanData.role === "admin"
            ? "Админ"
            : "Участник";

      clanInfoText = `\n🏰 Клан: ${clanData.name} (Ур. ${clanLevel})\nРоль: ${role}`;
    }

    const config = getLevelConfig(clanLevel);
    const textLimit = config.benefits.weeklyTextCredits;
    const used = user.weeklyTextUsage || 0;

    usageText = `${used}/${textLimit} кредитов (нед.)`;
    planName = `Free (Клан Ур. ${clanLevel})`;
  }

  // Get neat model name
  const currentModelKey = user.selectedModel || "model_gpt4omini";
  const currentModelName = MODEL_NAMES[currentModelKey] || currentModelKey;

  const text = `👤 <b>Мой профиль</b>:
ID: ${user.telegramId || "N/A"}
Подписка: ${planName}
Выбрана модель: ${currentModelName} /model${clanInfoText}

📊 <b>Статистика использования</b>
${usageText}

Нужно больше? Подключите /premium или развивайте Клан!

🚀 <b>Подписка Премиум</b>:
 └ 3000/6000 кредитов
 └ Доступ ко всем моделям
 └ Приоритетная скорость
 
🏰 <b>Мой Клан</b>: /clan
`;

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: getProfileKeyboard(),
  });
}

async function showSettingsMenu(ctx: any) {
  await ctx.reply(
    "⚙️ Настройки:\n\nЗдесь можно будет настроить параметры генерации."
  );
}

async function showHelp(ctx: any) {
  await ctx.reply(`🎱 Список команд:

/start - Перезапустить бота
/model - Выбрать нейросеть
/photo - Создать изображение
/video - Создать видео
/suno - Создать музыку
/s - Поиск в интернете
/account - Профиль
/premium - Премиум
/clear - Очистить контекст
/settings - Настройки
/privacy - Условия использования`);
}

async function showPrivacy(ctx: any) {
  await ctx.reply(
    "📄 Условия использования:\n\nИспользуя бота, вы соглашаетесь с правилами обработки данных и условиями сервиса."
  );
}

// --- Commands ---

bot.command("start", async (ctx) => {
  console.log("Received /start command");
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      console.warn("No Telegram ID found in context");
      return;
    }

    // Update Commands Menu
    await ctx.api.setMyCommands([
      { command: "start", description: "👋 О нас" },
      { command: "account", description: "👤 Профиль" },
      { command: "premium", description: "🚀 Премиум" },
      { command: "deletecontext", description: "💬 Очистить контекст" },
      { command: "photo", description: "🌅 Создать изображение" },
      { command: "video", description: "🎬 Создать видео" },
      { command: "video", description: "🎬 Создать видео" },
      { command: "s", description: "🔎 Поиск в интернете" },
      { command: "model", description: "📝 Выбрать модель" },
      { command: "settings", description: "⚙️ Настройки" },
      { command: "help", description: "🎱 Список команд" },
      { command: "privacy", description: "📄 Условия использования" },
    ]);

    // ... inside bot.command("start")

    // Extract payload from /start command (QR code source)
    const payload = ctx.match;
    const startParam =
      payload && typeof payload === "string" ? payload.trim() : undefined;

    // Analytics: Determine Source
    let sourceType = "Organic";
    if (startParam) {
      if (startParam.startsWith("qr_")) {
        sourceType = "QR Code";
      } else if (startParam.startsWith("sticker_")) {
        sourceType = "Sticker";
      } else if (
        startParam.startsWith("clan_") ||
        startParam.startsWith("ref_")
      ) {
        sourceType = "Referral";
      } else {
        sourceType = "Other Ref";
      }
    }

    const userIdStr = telegramId.toString();

    // Create user in DB FIRST if not exists (Critical for Join Clan)
    let [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      [user] = await createTelegramUser(telegramId, undefined, startParam);
      trackBackendEvent("User: Register", userIdStr, { source: sourceType });
    }

    trackBackendEvent("Bot: Launch", userIdStr, { source: sourceType });

    // CLAN INVITE HANDLING
    if (startParam?.startsWith("clan_")) {
      const inviteCode = startParam.replace("clan_", "").trim();
      if (inviteCode) {
        const clan = await getClanByInviteCode(inviteCode);
        if (clan) {
          await ctx.reply(
            `🏰 <b>Приглашение в клан</b>\n\nВы были приглашены в клан <b>${clan.name}</b>.\nВступите, чтобы получать бонусы и доступ к новым моделям!`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: `✅ Вступить в ${clan.name}`,
                      callback_data: `join_clan_${inviteCode}`,
                    },
                  ],
                  [{ text: "❌ Отмена", callback_data: "delete_message" }],
                ],
              },
            }
          );
          // We do NOT return here, we let the welcome message trigger too, or maybe we should return to focus on the invite?
          // User request: "updated everything in bot".
          // Let's allow the welcome message to follow, so they have the menu too.
        } else {
          await ctx.reply("❌ Клан с таким кодом не найден.");
        }
      }
    }

    // Reset model to default on start
    await updateUserSelectedModel(user.id, "model_gpt5nano");

    const welcomeMessage = `Привет! Ты в ИИ-боте №1 — здесь собраны все топовые нейросети мира для работы, учебы и творчества. 🚀

🎁 ТВОЙ БОНУС: У нас есть бесплатный доступ! Чем выше уровень твоего Клана, тем больше лимитов.

100 вопросов в неделю (на 5 уровне клана) на ChatGPT, DeepSeek, Gemini и умный поиск Perplexity.

ИИ-фотошоп и генератор графики тоже включены!

💎 В /PREMIUM (для профи): Самые мощные модели планеты: GPT-5.2, Claude, Midjourney, а также создание видео в Sora 2, Kling и Veo 3.1.

С чего начать?

✍️ НАПИШИ ЛЮБОЙ ВОПРОС — бот ответит мгновенно. Можно даже скинуть фото (например, задачу или конспект).

🔎 ПОИСК В СЕТИ (/s): Актуальные новости и факты из интернета в режиме реального времени.

� КАРТИНКИ (/photo): Создавай шедевры или редактируй свои фото через «Nano Banana».

🎬 ВИДЕО (/video): Оживляй свои идеи и создавай ролики в один клик.

⚙️ ВЫБОР МОЗГОВ: Нажми /model, чтобы сменить нейросеть.

Собери свой Клан и пользуйся ИИ на максимум!`;

    // Sanitize URL and force HTTPS
    let baseUrl = (
      process.env.NEXTAUTH_URL || "https://aporto.tech/app"
    ).replace(/\/$/, "");
    if (
      !baseUrl.startsWith("https://") &&
      !baseUrl.startsWith("http://localhost")
    ) {
      baseUrl = baseUrl.replace(/^http:\/\//, "https://");
    }

    // Debug command
    if (ctx.message?.text === "/debug") {
      await ctx.reply(
        `Base URL: ${baseUrl}\nButton URL: https://t.me/aporto_bot/app?startapp=app`
      );
      return;
    }

    // Auto-Pin Clan Message (FIRST)
    try {
      const pinMsg = await ctx.reply(
        "👑 <b>Объединяйтесь в кланы!</b>\n\nРазвивайте своё комьюнити вместе с друзьями и забирайте крутые привилегии для каждого участника:\n\n• Дополнительные кредиты каждую неделю\n• Безлимитный доступ к нейросетям (на 5 уровне)\n• Генерация картинок\n\n👇 Жми кнопку ниже, чтобы войти в игру и создать свой клан!",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🏰 Мой Клан",
                  url: "https://t.me/aporto_bot/app",
                },
              ],
            ],
          },
        }
      );
      await ctx.api.pinChatMessage(ctx.chat.id, pinMsg.message_id);
    } catch (e) {
      console.error("Failed to auto-pin clan message:", e);
    }

    // Add delay to ensure order (Clan -> Welcome)
    await new Promise((resolve) => setTimeout(resolve, 500));

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        keyboard: [
          ["📝 Выбрать модель", "🎨 Создать картинку"],
          ["🛠 Готовые сценарии"],
          ["🔎 Интернет-поиск", "🎬 Создать видео"],
          ["🚀 Премиум", "👤 Мой профиль"],
        ],
        resize_keyboard: true,
        is_persistent: true,
      },
    });
    console.log("Welcome message sent");
  } catch (error) {
    console.error("Error in /start command:", error);
    await ctx.reply("Sorry, I encountered an error. Please try again later.");
  }
});

bot.command("pin_clan", async (ctx) => {
  try {
    const message = await ctx.reply(
      "👑 <b>Объединяйтесь в кланы!</b>\n\nРазвивайте своё комьюнити вместе с друзьями и забирайте крутые привилегии для каждого участника:\n\n• Дополнительные кредиты каждую неделю\n• Безлимитный доступ к нейросетям (на 5 уровне)\n• Генерация картинок\n\n👇 Жми кнопку ниже, чтобы войти в игру и создать свой клан!",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🏰 Мой Клан",
                url: "https://t.me/aporto_bot/app",
              },
            ],
          ],
        },
      }
    );

    await ctx.api.pinChatMessage(ctx.chat.id, message.message_id);
    console.log("Clan message pinned");
  } catch (error) {
    console.error("Error pinning clan message:", error);
    await ctx.reply("Не удалось закрепить сообщение.");
  }
});

// --- Clan Callbacks ---
bot.callbackQuery(/^join_clan_(.+)$/, async (ctx) => {
  const inviteCode = ctx.match[1];
  const telegramId = ctx.from.id.toString();

  try {
    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.answerCallbackQuery("Пользователь не найден. Нажмите /start");
      return;
    }

    const res = await joinClan(user.id, inviteCode);

    if (res.success) {
      await ctx.answerCallbackQuery("Вы успешно вступили в клан! 🎉");
      await ctx.editMessageText(
        `✅ <b>Поздравляем!</b>\n\nВы вступили в клан <b>${res.clan?.name}</b>.\nТеперь вам доступны новые возможности! отправьте /start в бот чтобы обновить меню`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🏰 Открыть Клан",
                  url: "https://t.me/aporto_bot/app?startapp=clan",
                },
              ], // Deep link to clan? Or main app
            ],
          },
        }
      );

      // Try to pin clan message?
    } else {
      let errorMsg = "Не удалось вступить в клан.";
      if (res.error === "clan_not_found") {
        errorMsg = "Клан не найден.";
      }
      if (res.error === "already_in_this_clan") {
        errorMsg = "Вы уже в этом клане.";
      }
      if (res.error === "clan_full_redirect") {
        errorMsg = "Этот клан переполнен.";
      }

      await ctx.answerCallbackQuery(errorMsg);
      await ctx.reply(errorMsg);
    }
  } catch (e) {
    console.error("Join clan callback error", e);
    await ctx.answerCallbackQuery("Произошла ошибка.");
  }
});

bot.callbackQuery("delete_message", async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch (_e) {
    // ignore
  }
});

bot.command("clan", async (ctx) => {
  await ctx.reply("Откройте приложение клана:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🏰 Открыть Клан",
            web_app: { url: "https://aporto.tech/app" },
          },
        ],
      ],
    },
  });
});

bot.hears("⚔️ Мой клан", async (ctx) => {
  // If this handler triggers, the user has cached text-only button
  // Refresh keyboard to WebApp version
  await ctx.reply(
    "Обновляю меню... Нажмите на кнопку еще раз, чтобы открыть приложение.",
    {
      reply_markup: {
        keyboard: [
          ["📝 Выбрать модель", "🎨 Создать картинку"],
          ["🔎 Интернет-поиск", "🎬 Создать видео"],
          [
            {
              text: "⚔️ Мой клан",
              web_app: {
                url: "https://aporto.tech/app",
              },
            },
          ],
          ["🚀 Премиум", "👤 Мой профиль"],
        ],
        resize_keyboard: true,
        is_persistent: true,
      },
    }
  );

  // Send clan button as inline keyboard
  await ctx.reply("Или откройте приложение клана:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🏰 Открыть Клан",
            web_app: { url: "https://aporto.tech/app" },
          },
        ],
      ],
    },
  });
});

bot.callbackQuery("clan_create", async (ctx) => {
  await ctx.reply(
    "Введите название для нового клана в ответ на это сообщение:",
    {
      reply_markup: { force_reply: true },
    }
  );
  await safeAnswerCallbackQuery(ctx);
});

bot.callbackQuery("clan_join", async (ctx) => {
  await ctx.reply(
    "Введите код приглашения (например CLAN-X1Y2Z3) в ответ на это сообщение:",
    {
      reply_markup: { force_reply: true },
    }
  );
  await safeAnswerCallbackQuery(ctx);
});

bot.callbackQuery("clan_leave", async (ctx) => {
  const [user] = await getUserByTelegramId(ctx.from?.id.toString() || "");
  if (!user) {
    return;
  }
  const result = await leaveClan(user.id);
  if (result.success) {
    await ctx.reply("Вы покинули клан.");
    await showClanMenu(ctx, user);
  } else {
    await ctx.reply(`Ошибка: ${result.error}`);
  }
  await safeAnswerCallbackQuery(ctx);
});

bot.callbackQuery("clan_invite_link", async (ctx) => {
  const [user] = await getUserByTelegramId(ctx.from?.id.toString() || "");
  const clanData = await getUserClan(user?.id);
  if (clanData) {
    const link = `https://t.me/${ctx.me.username}?start=clan_${clanData.inviteCode}`;
    await ctx.reply(
      `Ваша ссылка для приглашения:\n${link}\n\nКод: ${clanData.inviteCode}`
    );
  }
  await safeAnswerCallbackQuery(ctx);
});

async function showClanMenu(ctx: any, user: any) {
  const clanData = await getUserClan(user.id);

  if (clanData) {
    // In Clan
    const counts = await getClanMemberCounts(clanData.id);
    const level = calculateClanLevel(counts.totalMembers, counts.proMembers);
    const config = getLevelConfig(level);
    const nextReq = getNextLevelRequirements(
      level,
      counts.totalMembers,
      counts.proMembers
    );

    let nextLevelText = "Максимальный уровень!";
    if (nextReq) {
      nextLevelText = `До уровня ${nextReq.nextLevel}: ${nextReq.description}`;
    }

    const roleName =
      clanData.role === "owner"
        ? "Глава"
        : clanData.role === "admin"
          ? "Админ"
          : "Участник";

    const text = `🏰 <b>${clanData.name}</b>\n
Уровень: ${level}
Участников: ${counts.totalMembers} (Pro: ${counts.proMembers})
Ваша роль: ${roleName}

🏆 <b>Бонусы уровня ${level}</b>:
• ${config.benefits.weeklyTextCredits} кредитов/неделю каждому
• ${config.benefits.weeklyImageGenerations} картинок
${level === 5 ? "• Безлимит на GPT-5 Nano, Gemini Flash\n" : ""}
📈 <b>Прогресс</b>:
${nextLevelText}

Код приглашения: <code>${clanData.inviteCode}</code>`;

    const buttons: any[] = [
      [{ text: "📨 Пригласить друзей", callback_data: "clan_invite_link" }],
      [{ text: "🚪 Покинуть клан", callback_data: "clan_leave" }],
    ];

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    // No Clan
    const text =
      "🏰 <b>Кланеры</b>\n\nВступайте в Клан или создайте свой, чтобы получать бонусы!\n\n💎 Бонусы клана:\n• Больше бесплатных кредитов\n• Доступ к GPT-4o mini, Gemini Flash безлимитно (на 5 уровне)\n• Генерация картинок";
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✨ Создать клан", callback_data: "clan_create" }],
          [{ text: "🛡 Вступить по коду", callback_data: "clan_join" }],
        ],
      },
    });
  }
}

// --- Scenarios Handlers ---

// 1. Show Scenarios Menu
bot.hears("🛠 Готовые сценарии", async (ctx) => {
  const buttons: any[][] = [];

  // Group by 2
  for (let i = 0; i < SCENARIOS.length; i += 2) {
    const row = SCENARIOS.slice(i, i + 2).map((cat) => ({
      text: `${cat.emoji} ${cat.title}`,
      callback_data: `scenarios_cat_${cat.id}`,
    }));
    buttons.push(row);
  }

  // Add "Close" or "Back"
  buttons.push([{ text: "🔙 Закрыть", callback_data: "menu_close" }]);

  await ctx.reply("🛠 <b>Готовые сценарии</b>\n\nВыберите категорию:", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
});

// 2. Handle Category Selection
bot.callbackQuery(/^scenarios_cat_(.+)$/, async (ctx) => {
  const catId = ctx.match[1];
  const category = SCENARIOS.find((c) => c.id === catId);

  if (!category) {
    await ctx.answerCallbackQuery("Категория не найдена");
    return;
  }

  const buttons = category.items.map((item) => [
    {
      text: item.title,
      callback_data: `scenario_item_${item.id}`,
    },
  ]);

  buttons.push([
    { text: "🔙 Назад к категориям", callback_data: "scenarios_back" },
  ]);

  await ctx.editMessageText(
    `<b>${category.emoji} ${category.title}</b>\n\nВыберите сценарий:`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
  );
  await safeAnswerCallbackQuery(ctx);
});

// 3. Handle Item Selection (Show Prompt)
bot.callbackQuery(/^scenario_item_(.+)$/, async (ctx) => {
  const itemId = ctx.match[1];

  // Flatten search
  let foundItem: any = null;

  for (const cat of SCENARIOS) {
    const item = cat.items.find((i) => i.id === itemId);
    if (item) {
      foundItem = item;
      break;
    }
  }

  if (!foundItem) {
    await ctx.answerCallbackQuery("Сценарий не найден");
    return;
  }

  const instruction = foundItem.description
    ? `\nℹ️ <i>${foundItem.description}</i>`
    : "";

  const responseText = `<b>${foundItem.title}</b>${instruction}\n\nНажмите на текст ниже, чтобы скопировать, и отправьте боту:\n\n<code>${foundItem.prompt}</code>`;

  // We send a NEW message so user can see it easily and copy.
  // We can also edit the current one but then context is lost?
  // User asked to "fill input", we simulate this by making it easy to copy.
  // We keep the menu open? Or better, send new message and keep menu?
  // Let's Edit if it's navigation, but here it's "Result".
  // If we Edit, user might lose the menu.
  // Let's send a new message and answer callback.

  await ctx.reply(responseText, { parse_mode: "HTML" });
  await safeAnswerCallbackQuery(ctx, "Скопируйте текст и отправьте боту");
});

// 4. Back Button Handler
bot.callbackQuery("scenarios_back", async (ctx) => {
  // Re-render main categories
  const buttons: any[][] = [];
  for (let i = 0; i < SCENARIOS.length; i += 2) {
    const row = SCENARIOS.slice(i, i + 2).map((cat) => ({
      text: `${cat.emoji} ${cat.title}`,
      callback_data: `scenarios_cat_${cat.id}`,
    }));
    buttons.push(row);
  }
  buttons.push([{ text: "🔙 Закрыть", callback_data: "menu_close" }]);

  await ctx.editMessageText(
    "🛠 <b>Готовые сценарии</b>\n\nВыберите категорию:",
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
  );
  await safeAnswerCallbackQuery(ctx);
});

bot.command("clear", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }

  try {
    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply("Сначала нужно начать диалог командой /start");
      return;
    }

    // Create a new chat to "clear" history context
    const chatId = generateUUID();
    await saveChat({
      id: chatId,
      userId: user.id,
      title: "Telegram Chat (Cleared)",
      visibility: "private",
    });

    // Reset model to default
    await updateUserSelectedModel(user.id, "model_gpt5nano");

    await ctx.reply(
      "🧹 История очищена! Я забыл всё, о чём мы говорили ранее.\nГотов к новому диалогу! 🚀"
    );
  } catch (error) {
    console.error("Error in /clear command:", error);
    await ctx.reply("Не удалось очистить историю. Попробуйте позже.");
  }
});

bot.command("account", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }
  const [user] = await getUserByTelegramId(telegramId);
  await showAccountInfo(ctx, user);
});

bot.command("premium", async (ctx) => {
  await showPremiumMenu(ctx);
});

bot.command("unsubscribe", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }

  try {
    try {
      await ctx.deleteMessage();
    } catch {
      // ignore
    }

    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply("❌ Пользователь не найден. Нажмите /start");
      return;
    }

    const sub = await getLastActiveSubscription(user.id);

    // Debug logging to help trace if needed
    console.log(`[Unsubscribe Command] User: ${user.id}, Sub: ${sub?.id}`);

    if (!sub) {
      await ctx.reply("❌ У вас нет активной подписки.");
      return;
    }

    if (!sub.autoRenew) {
      const dateStr = sub.endDate.toLocaleDateString("ru-RU");
      await ctx.reply(
        `✅ Автопродление уже отключено.\nВаша подписка действует до ${dateStr}.`
      );
      return;
    }

    const tariffName = sub.tariffSlug.includes("premium_x2")
      ? "Premium X2"
      : "Premium";

    await ctx.reply(
      `Вы хотите отменить автоматическое списание по подписке <b>${tariffName}</b>?`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Подтвердить",
                callback_data: "unsubscribe_confirm",
              },
            ],
            [
              {
                text: "🔙 Назад",
                callback_data: "unsubscribe_back",
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error("Error in /unsubscribe:", error);
    await ctx.reply("Произошла ошибка. Попробуйте позже.");
  }
});

bot.command("deletecontext", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }

  try {
    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply("Сначала нужно начать диалог командой /start");
      return;
    }
    const chatId = generateUUID();
    await saveChat({
      id: chatId,
      userId: user.id,
      title: "Telegram Chat (Cleared)",
      visibility: "private",
    });

    // Reset model to default
    await updateUserSelectedModel(user.id, "model_gpt5nano");

    await ctx.reply(
      "🧹 История очищена! Я забыл всё, о чём мы говорили ранее.\nГотов к новому диалогу! 🚀"
    );
  } catch (error) {
    console.error("Error in /deletecontext command:", error);
    await ctx.reply("Не удалось очистить историю. Попробуйте позже.");
  }
});

bot.command("photo", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }
  const [user] = await getUserByTelegramId(telegramId);
  if (user) {
    await showImageMenu(ctx, user);
  }
});

bot.command("video", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }
  const [user] = await getUserByTelegramId(telegramId);
  if (user) {
    await showVideoMenu(ctx, user);
  }
});

bot.command("s", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }
  const [user] = await getUserByTelegramId(telegramId);
  if (user) {
    await showSearchMenu(ctx, user);
  }
});

bot.command("model", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }
  const [user] = await getUserByTelegramId(telegramId);
  if (user) {
    await showModelMenu(ctx, user);
  }
});

bot.command("settings", async (ctx) => {
  await showSettingsMenu(ctx);
});

bot.command("help", async (ctx) => {
  await showHelp(ctx);
});

bot.command("privacy", async (ctx) => {
  await showPrivacy(ctx);
});

// --- Callback Query Handler ---

bot.on("callback_query:data", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const data = ctx.callbackQuery.data;

  // Handle menu navigation
  if (data === "menu_start" || data === "menu_close") {
    await ctx.deleteMessage();
    await safeAnswerCallbackQuery(ctx);
    return;
  }

  // Handle Unsubscribe Confirm
  if (data === "unsubscribe_confirm") {
    await safeAnswerCallbackQuery(ctx, "Отменяю подписку...");

    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.editMessageText("❌ Пользователь не найден.");
      return;
    }

    const sub = await getLastActiveSubscription(user.id);
    if (!sub) {
      await ctx.editMessageText("❌ Подписка не найдена.");
      return;
    }

    await cancelUserSubscription(user.id);

    // Create detailed success message
    const dateStr = sub.endDate.toLocaleDateString("ru-RU");
    const successMsg = `✅ <b>Автопродление отключено</b>
    
Ваша подписка остается активной до <b>${dateStr}</b>.
После этой даты списаний не будет.`;

    await ctx.editMessageText(successMsg, { parse_mode: "HTML" });
    return;
  }

  // Handle Unsubscribe Back
  if (data === "unsubscribe_back") {
    await safeAnswerCallbackQuery(ctx);
    try {
      await ctx.deleteMessage();
    } catch {
      // Ignore delete errors
    }
    // Optionally return to profile or main menu, or just delete.
    // User requested "Back", usually means "Cancel the action".
    return;
  }

  // Handle model selection
  if (data.startsWith("model_")) {
    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      await safeAnswerCallbackQuery(ctx);
      return;
    }

    const isFreeModel = FREE_MODELS.includes(data);

    // Premium check - Strict Lock
    if (!user.hasPaid && !isFreeModel) {
      const modelName = MODEL_NAMES[data] || "Selected Model";
      await ctx.editMessageText(
        `⚠️ Для отправки запросов к модели ${modelName} приобретите подписку Премиум`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🚀 Подключить премиум",
                  callback_data: "open_premium",
                },
              ],
              [{ text: "🔙 Назад", callback_data: "menu_start" }],
            ],
          },
        }
      );
      await safeAnswerCallbackQuery(ctx);
      return;
    }

    // Update selection
    await updateUserSelectedModel(user.id, data);

    // Create a new chat to "clear" history context when model changes
    const chatId = generateUUID();
    await saveChat({
      id: chatId,
      userId: user.id,
      title: "Telegram Chat (New Model)",
      visibility: "private",
    });

    // Notify about high cost models
    await ensureModelsLoaded();
    const dbModel = CACHED_MODELS?.find((m) => m.modelId === data);
    const cost = dbModel ? dbModel.cost : MODEL_COSTS[data] || 1;

    if (cost > 1 && !isFreeModel) {
      const modelName = dbModel?.name || MODEL_NAMES[data] || data;

      let prefix = "Чат";
      if (data.includes("video") || dbModel?.type === "video") {
        prefix = "Видео";
      } else if (
        data.includes("image") ||
        dbModel?.type === "image" ||
        data.includes("midjourney") ||
        data.includes("flux") ||
        data.includes("banana")
      ) {
        prefix = "Изображение";
      }

      let plural = "генераций";
      const lastDigit = cost % 10;
      const lastTwo = cost % 100;

      if (lastDigit === 1 && lastTwo !== 11) {
        plural = "генерацию";
      } else if (
        [2, 3, 4].includes(lastDigit) &&
        ![12, 13, 14].includes(lastTwo)
      ) {
        plural = "генерации";
      }

      const message = `${prefix} с моделью ${modelName} расходует\n${cost} ${plural}`;
      await safeAnswerCallbackQuery(ctx, message, { show_alert: true });
    }

    // Special handling for Nano Banana (Free)
    if (data === "model_image_nano_banana") {
      try {
        await ctx.deleteMessage();
      } catch (_e) {
        /* ignore */
      }

      await ctx.replyWithPhoto(
        new InputFile(
          path.join(process.cwd(), "public", "nano_banana_intro.jpg")
        ),
        {
          caption:
            "Создавайте и редактируйте изображения прямо в чате.\n\nГотовы начать?\nОтправьте изображение, которое вы хотите изменить, или напишите в чат, что нужно создать",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Назад", callback_data: "menu_start" }],
            ],
          },
        }
      );
      await safeAnswerCallbackQuery(ctx, "Модель выбрана!");
      return;
    }

    // Determine which keyboard to use based on model type
    try {
      let keyboard: { inline_keyboard: any[][] };
      if (data.startsWith("model_image_")) {
        keyboard = getImageModelKeyboard(data, !!user.hasPaid);
      } else if (data.startsWith("model_video_")) {
        keyboard = getVideoModelKeyboard(data, !!user.hasPaid);
      } else if (
        ["model_perplexity", "model_grok41", "model_deepresearch"].includes(
          data
        )
      ) {
        keyboard = getSearchModelKeyboard(data, !!user.hasPaid);
      } else {
        keyboard = getModelKeyboard(data, !!user.hasPaid);
      }

      await ctx.editMessageReplyMarkup({
        reply_markup: keyboard,
      });
      await safeAnswerCallbackQuery(ctx, "Модель выбрана!");
    } catch (_e) {
      await safeAnswerCallbackQuery(ctx);
    }
    return;
  }

  // Handle consent confirmation
  if (data === "confirm_terms_image") {
    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      return;
    }

    try {
      await createUserConsent(user.id, "image_generation", {
        telegramId,
      });

      await ctx.deleteMessage();

      const currentModel = user.selectedModel?.startsWith("model_image_")
        ? user.selectedModel
        : "model_image_nano_banana";

      await ctx.reply("Выберите модель для создания изображений:", {
        reply_markup: getImageModelKeyboard(currentModel, !!user?.hasPaid),
      });
      await safeAnswerCallbackQuery(ctx, "Условия приняты!");
    } catch (e) {
      console.error("Consent error:", e);
      await safeAnswerCallbackQuery(ctx, undefined, {
        text: "Ошибка сохранения согласия. Попробуйте позже.",
        show_alert: true,
      });
    }
    return;
  }

  // Handle full premium menu display (replace mode)
  if (data === "open_premium") {
    await ctx.editMessageText(PREMIUM_MENU_TEXT, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: getPremiumKeyboard(),
    });
    await safeAnswerCallbackQuery(ctx);
    return;
  }

  // Handle premium menu navigation
  if (data === "buy_premium") {
    await ctx.editMessageReplyMarkup({
      reply_markup: await getSubscriptionKeyboard("premium"),
    });
    await safeAnswerCallbackQuery(ctx);
    return;
  }
  if (data === "buy_premium_x2") {
    await ctx.editMessageReplyMarkup({
      reply_markup: await getSubscriptionKeyboard("premium_x2"),
    });
    await safeAnswerCallbackQuery(ctx);
    return;
  }
  if (data === "premium_back") {
    await ctx.editMessageReplyMarkup({ reply_markup: getPremiumKeyboard() });
    await safeAnswerCallbackQuery(ctx);
    return;
  }

  // Handle payment creation
  if (data.startsWith("pay_")) {
    const rawArgs = data.replace("pay_", "");

    // Detect Stars Payment
    const isStars = rawArgs.startsWith("stars_");
    const cleanArgs = isStars ? rawArgs.replace("stars_", "") : rawArgs;

    let planKey: "premium" | "premium_x2" = "premium";
    let months = 1;

    if (cleanArgs.startsWith("premium_x2_")) {
      planKey = "premium_x2";
      months = Number.parseInt(cleanArgs.replace("premium_x2_", ""), 10);
    } else {
      planKey = "premium";
      months = Number.parseInt(cleanArgs.replace("premium_", ""), 10);
    }

    const tariffSlug = `${planKey}_${months}`;

    // Fetch tariff from DB
    const tariff = await getTariffBySlug(tariffSlug);
    if (!tariff) {
      await safeAnswerCallbackQuery(ctx, "Тариф не найден.", {
        show_alert: true,
      });
      return;
    }

    const description = tariff.name; // or construct: `${planKey === "premium_x2" ? "Premium X2" : "Premium"} (${months} мес)`;
    const priceRub = tariff.priceRub;
    const priceStars = tariff.priceStars;

    if (isStars) {
      if (!priceStars) {
        await safeAnswerCallbackQuery(ctx, "Error: Price not found");
        return;
      }

      await safeAnswerCallbackQuery(ctx, "Создаю инвойс...");
      // sendInvoice(chat_id, title, description, payload, provider_token, currency, prices)
      await ctx.replyWithInvoice(
        description, // title
        `Оплата подписки ${description}`, // description
        tariffSlug, // payload
        "XTR", // currency
        [{ label: description, amount: priceStars }] // prices
      );
      return;
    }

    // Existing YooKassa Logic
    const price = priceRub; // From DB tariff

    if (!price) {
      await safeAnswerCallbackQuery(ctx, "Error: Invalid plan");
      return;
    }

    await safeAnswerCallbackQuery(ctx, "Создаю счет...");
    try {
      await ctx.deleteMessage();
    } catch {
      // ignore
    }

    const placeholder = await ctx.reply("⏳ Создаю платеж...");

    const payment = await createYookassaPayment(
      price,
      description,
      telegramId,
      tariffSlug,
      placeholder.message_id
    );

    if (payment?.confirmation?.confirmation_url) {
      const payUrl = payment.confirmation.confirmation_url;
      const days = months * 30;
      const requestLimit = planKey === "premium_x2" ? 200 : 100;
      const title = planKey === "premium_x2" ? "Premium X2" : "Premium";

      const messageText = `Вы оформляете подписку ${title} с регулярным списанием раз в ${days} календарных дней.
Вам будет доступно ${requestLimit} запросов в день.
Стоимость - ${price} ₽.

Отменить можно по команде /unsubscribe.

Оформляя оплату Вы даете согласие на условия оферты рекуррентных платежей, политики обработки персональных данных и тарифа.

Если у вас есть вопросы по подписке или оплате, напишите нам @GoPevzner .`;

      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        messageText,
        {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [
              [{ text: "Карта 💳", url: payUrl }],
              [{ text: "СБП 🏛", url: payUrl }],
              [
                {
                  text: "Оплатить Telegram Stars",
                  callback_data: `pay_stars_${planKey}_${months}`,
                },
              ],
            ],
          },
        }
      );
    } else {
      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "❌ Ошибка создания платежа. Попробуйте позже или свяжитесь с поддержкой."
      );
    }
    return;
  }

  // Handle Pack Selection
  if (data === "open_packets") {
    const packs = [
      { name: "1500 запросов", price: "400₽", slug: "pack_requests_1500" },
      { name: "3000 запросов", price: "750₽", slug: "pack_requests_3000" },
      { name: "7000 запросов", price: "2000₽", slug: "pack_requests_7000" },
    ];

    const buttons = packs.map((framework) => [
      {
        text: `${framework.name} - ${framework.price}`,
        callback_data: `select_pack_${framework.slug}`,
      },
    ]);
    buttons.push([{ text: "🔙 Назад", callback_data: "open_premium" }]);

    await ctx.editMessageText(
      "<b>📦 Пакеты запросов</b>\n\nЕсли 1500 лимитов в месяц тебе мало — просто докупи пакет расширения. Дополнительные запросы не сгорают в конце месяца и будут ждать, пока ты их используешь!",
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      }
    );
    return;
  }

  // Handle Pack Payment Init
  if (data.startsWith("select_pack_")) {
    const slug = data.replace("select_pack_", "");
    const tariff = await getTariffBySlug(slug);

    if (!tariff) {
      await safeAnswerCallbackQuery(ctx, "Тариф не найден");
      return;
    }

    await safeAnswerCallbackQuery(ctx, "Создаю счет...");

    const placeholder = await ctx.reply("⏳ Создаю платеж...");
    const payment = await createYookassaPayment(
      tariff.priceRub,
      tariff.description || tariff.name,
      telegramId,
      tariff.slug,
      placeholder.message_id
    );

    if (payment?.confirmation?.confirmation_url) {
      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        `Оплата тарифа: <b>${tariff.name}</b>\nСумма: ${tariff.priceRub}₽`,
        {
          parse_mode: "HTML",
          reply_markup: getPaymentMethodKeyboard(
            payment.confirmation.confirmation_url
          ),
        }
      );
    } else {
      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "Ошибка платежа."
      );
    }
    return;
  }

  // Handle Subscription Selection (sub_pro_*)
  if (data.startsWith("sub_")) {
    const slug = data;
    const tariff = await getTariffBySlug(slug);

    if (!tariff) {
      await safeAnswerCallbackQuery(ctx, "Тариф не найден");
      return;
    }

    await safeAnswerCallbackQuery(ctx, "Создаю счет...");

    const placeholder = await ctx.reply("⏳ Создаю платеж...");
    const payment = await createYookassaPayment(
      tariff.priceRub,
      tariff.description || tariff.name,
      telegramId,
      tariff.slug,
      placeholder.message_id
    );

    if (payment?.confirmation?.confirmation_url) {
      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        `Подписка: <b>${tariff.name}</b>\nСумма: ${tariff.priceRub}₽`,
        {
          parse_mode: "HTML",
          reply_markup: getPaymentMethodKeyboard(
            payment.confirmation.confirmation_url
          ),
        }
      );
    } else {
      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "Ошибка платежа."
      );
    }
    return;
  }

  // Handle Premium Sub-menu
  if (data === "open_premium_subs") {
    await ctx.editMessageText("Выберите период подписки:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "1 мес. (400₽)", callback_data: "sub_pro_1" },
            { text: "3 мес. (1080₽) -10%", callback_data: "sub_pro_3" },
          ],
          [
            { text: "6 мес. (2040₽) -15%", callback_data: "sub_pro_6" },
            { text: "12 мес. (3840₽) -20%", callback_data: "sub_pro_12" },
          ],
          [{ text: "🔙 Назад", callback_data: "open_premium" }],
        ],
      },
    });
    return;
  }

  // Handle Clan Pro Stub
  if (data === "open_clan_pro") {
    const clanProOptions = [
      { text: "1 Месяц - 4200₽", callback_data: "clan_pro_stub" },
      { text: "3 Месяца -5%", callback_data: "clan_pro_stub" },
      { text: "6 Месяцев -10%", callback_data: "clan_pro_stub" },
      { text: "12 Месяцев -15%", callback_data: "clan_pro_stub" },
    ];
    const buttons = clanProOptions.map((o) => [o]);
    buttons.push([{ text: "🔙 Назад", callback_data: "open_premium" }]);

    await ctx.editMessageText(
      "👥 <b>Подписка для Клана</b>\n\nДо 15 участников. Оплата единым счетом.\nВыгоднее, чем покупать отдельно каждому!",
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      }
    );
    return;
  }

  if (data === "clan_pro_stub") {
    await ctx.answerCallbackQuery({
      text: "Напишите нам для подключения: @GoPevzner",
      show_alert: true,
    });
    return;
  }

  // Handle other "buy_" buttons (placeholders for Packs)
  if (
    data === "/premium" ||
    data === "/pro" ||
    data.startsWith("buy_") ||
    data.startsWith("music_mode_")
  ) {
    await safeAnswerCallbackQuery(ctx, "В разработке...");
    await ctx.reply(
      "Выбор пакетов (Video, MJ, Suno) скоро появится. Пока доступна только подписка Premium."
    );
    return;
  }

  await safeAnswerCallbackQuery(ctx);
  await safeAnswerCallbackQuery(ctx);
});

// Checkout Handlers for Stars
bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment;
  const tariffSlug = payment.invoice_payload;
  const telegramId = ctx.from.id.toString();
  const totalAmount = payment.total_amount;

  console.log(
    `Successful Stars payment: ${totalAmount} XTR for ${tariffSlug} from user ${telegramId}`
  );

  try {
    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      console.error(`User not found for payment: ${telegramId}`);
      return;
    }

    if (tariffSlug.startsWith("pack_")) {
      // Request Pack
      const tariff = await getTariffBySlug(tariffSlug);
      if (tariff?.requestLimit) {
        await addExtraRequests(user.id, tariff.requestLimit);
        await ctx.reply(
          `✅ Оплата прошла успешно!\nДобавлено ${tariff.requestLimit} запросов.`
        );
      } else {
        await ctx.reply(
          "✅ Оплата прошла, но тариф не найден. Напишите в поддержку."
        );
      }
    } else {
      // Subscription
      const parts = tariffSlug.split("_");
      const months = Number.parseInt(parts.at(-1) ?? "1", 10);
      const durationDays = months * 30;

      await createStarSubscription(user.id, tariffSlug, durationDays);

      await ctx.reply(
        `✅ Оплата прошла успешно!\nПодписка активирована на ${months} мес.`
      );
    }
  } catch (error) {
    console.error("Error processing successful_payment:", error);
    await ctx.reply("⚠️ Оплата принята, но произошла ошибка активации.");
  }
});

// --- Message Handlers ---

bot.on("message:text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  // --- Clan Inputs Handler ---
  const replyText = ctx.message.reply_to_message?.text;
  if (replyText) {
    if (replyText.includes("Введите название для нового клана")) {
      const [user] = await getUserByTelegramId(telegramId);
      if (user) {
        const result = await createClan(user.id, text.trim());
        if (result.success) {
          await ctx.reply(`Клан "${text}" создан!`);
          await showClanMenu(ctx, user);
        } else {
          await ctx.reply(
            `Ошибка: ${result.error === "name_taken" ? "Имя занято" : result.error}`
          );
        }
      }
      return;
    }
    if (replyText.includes("Введите код приглашения")) {
      const [user] = await getUserByTelegramId(telegramId);
      if (user) {
        const result = await joinClan(user.id, text.trim().toUpperCase()); // codes usually uppercase
        if (result.success) {
          await ctx.reply("Вы вступили в клан!");
          await showClanMenu(ctx, user);
        } else {
          await ctx.reply(
            `Ошибка: ${result.error === "clan_not_found" ? "Клан не найден" : result.error}`
          );
        }
      }
      return;
    }
  }

  // Helper for button handling
  const handleButton = async (action: (user: any) => Promise<void>) => {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      // ignore
    }
    const [user] = await getUserByTelegramId(telegramId);
    if (user) {
      await action(user);
    }
  };

  if (text === "📝 Выбрать модель") {
    await handleButton((user) => showModelMenu(ctx, user));
    return;
  }

  if (text === "🎨 Создать картинку") {
    await handleButton((user) => showImageMenu(ctx, user));
    return;
  }

  if (text === "🔎 Интернет-поиск") {
    await handleButton((user) => showSearchMenu(ctx, user));
    return;
  }

  if (text === "🎬 Создать видео") {
    await handleButton((user) => showVideoMenu(ctx, user));
    return;
  }

  if (text === "🎸 Создать песню") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      // ignore
    }
    await showMusicMenu(ctx);
    return;
  }

  // --- Admin Commands ---
  if (text.startsWith("/")) {
    const parts = text.split(" ");
    const command = parts[0];

    // Helper: Check Admin
    const isAdmin = async () => {
      const [user] = await getUserByTelegramId(telegramId);
      // Bootstrap: If ID matches hardcoded owner (replace with real ID if known) OR user.isAdmin
      const OWNER_ID = "YOUR_TELEGRAM_ID_HERE"; // Replace or rely on DB
      return user?.isAdmin || telegramId === OWNER_ID; // Fallback for first run
    };

    if (command === "/admin" && (await isAdmin())) {
      const targetId = parts[1] || telegramId;
      const [target] = await getUserByTelegramId(targetId);
      if (!target) {
        await ctx.reply("User not found.");
        return;
      }
      await ctx.reply(
        `👤 <b>User Report</b>
ID: <code>${target.telegramId}</code>
Role: <b>${target.hasPaid ? "Premium/Pro" : "Free"}</b>
Admin: ${target.isAdmin ? "✅" : "❌"}
Requests: ${target.requestCount}
Limit: ${target.hasPaid ? SUBSCRIPTION_LIMITS.premium : SUBSCRIPTION_LIMITS.free}
Last Reset: ${target.lastResetDate ? target.lastResetDate.toISOString() : "Never"}`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (command === "/set_premium" && (await isAdmin())) {
      const targetId = parts[1];
      const status = parts[2] === "on";
      if (!targetId) {
        await ctx.reply("Usage: /set_premium [tg_id] [on/off]");
        return;
      }

      const [target] = await getUserByTelegramId(targetId);
      if (target) {
        await setUserDetails({
          userId: target.id,
          hasPaid: status,
          isActive: true,
        });
        await ctx.reply(`User ${targetId} premium set to ${status}`);
      } else {
        await ctx.reply(
          "User not found via Telegram ID. Ensure they have started the bot."
        );
      }
      return;
    }

    if (command === "/set_limit" && (await isAdmin())) {
      const targetId = parts[1];
      const amount = Number.parseInt(parts[2], 10);
      if (!targetId || Number.isNaN(amount)) {
        await ctx.reply("Usage: /set_limit [tg_id] [amount]");
        return;
      }

      const [target] = await getUserByTelegramId(targetId);
      if (target) {
        await setUserDetails({ userId: target.id, requestCount: amount });
        await ctx.reply(`User ${targetId} request count set to ${amount}`);
      }
      return;
    }

    if (command === "/make_admin" && (await isAdmin())) {
      const targetId = parts[1];
      if (!targetId) {
        await ctx.reply("Usage: /make_admin [tg_id]");
        return;
      }
      const [target] = await getUserByTelegramId(targetId);
      if (target) {
        await setUserDetails({ userId: target.id, isAdmin: true });
        await ctx.reply(`User ${targetId} is now an Admin.`);
      }
      return;
    }

    // Secret Seeding Command
    if (command === "/seed_models" && (await isAdmin())) {
      await ctx.reply("Seeding models...");
      let count = 0;

      // Seed MODEL_COSTS
      for (const [id, cost] of Object.entries(MODEL_COSTS)) {
        await upsertAiModel({
          modelId: id,
          name: id,
          provider: id.split("/")[0] || "unknown",
          type: id.includes("image") ? "image" : "text",
          cost,
          isEnabled: true,
        });
        count++;
      }

      // Seed FEATURE_COSTS (as pseudo-models)
      for (const [key, cost] of Object.entries(FEATURE_COSTS)) {
        await upsertAiModel({
          modelId: key,
          name: key,
          provider: "feature",
          type: "feature",
          cost,
          isEnabled: true,
        });
        count++;
      }
      await ctx.reply(`Seeded ${count} models/features.`);
      return;
    }
  }

  if (text === "🚀 Премиум" || text === "/premium") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      // ignore
    }
    await showPremiumMenu(ctx);
    return;
  }

  if (text === "👤 Мой профиль") {
    await handleButton((user) => showAccountInfo(ctx, user));
    return;
  }

  // Handle /unsubscribe is done via bot.command("unsubscribe")

  // Regular message processing
  // Regular message processing
  try {
    // 0. Drop Stale Updates
    const messageDate = ctx.message.date;
    const now = Math.floor(Date.now() / 1000);

    if (now - messageDate > 60) {
      console.warn(
        `Dropping stale update from user ${telegramId} (delay: ${now - messageDate}s)`
      );
      return;
    }

    // 1. Get or Create User
    let [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      [user] = await createTelegramUser(telegramId);
    }

    // 1.1 Idempotency Check
    const isNew = await setLastMessageId(
      user.id,
      ctx.message.message_id.toString()
    );
    if (!isNew) {
      console.warn(
        `Dropping duplicate/concurrent processing for message ${ctx.message.message_id}`
      );
      return;
    }

    // --- ENFORCEMENT START ---
    const userType: "pro" | "regular" = user.hasPaid ? "pro" : "regular";
    const entitlements = entitlementsByUserType[userType];

    // A. Character Limit
    // Use Model Limit if defined, otherwise fallback to entitlement
    const selectedId = user.selectedModel || "model_gpt4omini";
    const modelLimit = MODEL_LIMITS[selectedId] || entitlements.charLimit;

    if (text.length > modelLimit) {
      await ctx.reply(
        `⚠️ Сообщение слишком длинное. Лимит модели: ${modelLimit} символов.`
      );
      return;
    }

    // B. Cost & Subscription Limit
    const cost = await calculateRequestCost(
      user.selectedModel || "model_gpt4omini",
      text.length
    );

    // Check clan level requirement first
    const hasAccess = await checkClanLevelRequirement(
      ctx,
      user,
      user.selectedModel || "model_gpt4omini"
    );
    if (!hasAccess) {
      return;
    }

    const allowed = await checkAndEnforceLimits(
      ctx,
      user,
      cost,
      user.selectedModel || "model_gpt4omini"
    );
    if (!allowed) {
      return;
    }

    // --- ENFORCEMENT END ---

    // 2. Find active chat or create new one
    const { chats } = await getChatsByUserId({
      id: user.id,
      limit: 1,
      startingAfter: null,
      endingBefore: null,
    });

    let chatId: string;

    if (chats.length > 0) {
      chatId = chats[0].id;
    } else {
      chatId = generateUUID();
      await saveChat({
        id: chatId,
        userId: user.id,
        title: "Telegram Chat",
        visibility: "private",
      });
    }

    // 3. Save User Message
    const userMessageId = generateUUID();
    await saveMessages({
      messages: [
        {
          id: userMessageId,
          chatId,
          role: "user",
          parts: [{ type: "text", text }],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    // 5. Generate Response using selected model
    const selectedModelId = user.selectedModel || "model_gpt4omini";

    // Track Request (Now safe to use selectedModelId)
    trackBackendEvent("Request: Chat", user.id.toString(), {
      param_model: selectedModelId,
      param_type: "text",
      param_cost: cost,
      param_length: text.length,
    });

    // 4. Fetch History
    const history = await getMessagesByChatId({ id: chatId });
    const aiMessages: any[] = history.map((m) => ({
      role: m.role,
      content: (m.parts as any[]).map((p) => p.text).join("\n"),
    }));

    // --- Image Generation Flow ---
    if (selectedModelId?.startsWith("model_image_")) {
      const imageModelConfig = IMAGE_MODELS[selectedModelId];

      if (!imageModelConfig || !imageModelConfig.enabled) {
        await ctx.reply(
          "⚠️ Эта модель пока недоступна или находится в разработке."
        );
        return;
      }

      // Check clan level requirement first
      const hasAccess = await checkClanLevelRequirement(
        ctx,
        user,
        selectedModelId
      );
      if (!hasAccess) {
        return;
      }

      // Enforce Limits
      const allowed = await checkAndEnforceLimits(
        ctx,
        user,
        1, // Cost 1? Or look up model cost? Usually 1 generation = 1 credit or handled by isImage logic in check function
        selectedModelId
      );

      if (!allowed) {
        return;
      }

      await ctx.replyWithChatAction("upload_photo");
      await ctx.reply(`🎨 Генерирую (${imageModelConfig.name}): "${text}"...`);

      trackBackendEvent("Model: Request", telegramId, {
        model: selectedModelId,
        type: "image",
        status: "attempt",
        prompt_length: text.length,
      });

      try {
        // SWITCH PROVIDER LOGIC
        switch (imageModelConfig.provider) {
          case "openai": {
            const { experimental_generateImage } = await import("ai");
            const { openai } = await import("@ai-sdk/openai"); // Using existing import if available, or dynamic

            // ... existing openai logic should remain but be careful not to double import if not needed
            // Actually, let's keep the existing logic structure but insert the new case
            const { image } = await experimental_generateImage({
              model: openai.image(imageModelConfig.id),
              prompt: text,
              n: 1,
              size: "1024x1024",
              providerOptions: {
                openai: { quality: "low" },
              },
            });

            if (image?.base64) {
              const buffer = Buffer.from(image.base64, "base64");
              await ctx.replyWithPhoto(
                new InputFile(buffer, `image_${Date.now()}.png`),
                {
                  caption: "Сделано в @aporto_bot",
                }
              );
            } else {
              throw new Error("No image data returned from OpenAI");
            }
            break;
          }

          case "openrouter": {
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) {
              throw new Error("Missing OPENROUTER_API_KEY");
            }

            // Direct fetch to OpenRouter Chat Completions for Image Generation
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60 seconds timeout

            const response = await fetch(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://aporto.tech", // Optional, encouraged by OpenRouter
                  "X-Title": "Aporto Bot", // Optional
                },
                body: JSON.stringify({
                  model: imageModelConfig.id,
                  messages: [{ role: "user", content: text }],
                  // Explicitly request image and text capabilities
                  modalities: ["image", "text"],
                }),
                signal: controller.signal,
              }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
              const err = await response.text();
              console.error("OpenRouter API Error:", response.status, err);
              throw new Error(
                `OpenRouter API Error: ${response.status} - ${err}`
              );
            }

            const data = await response.json();
            console.log("OpenRouter Response:", JSON.stringify(data, null, 2));

            // OpenRouter returns images in message.images array, not in content
            const message = data.choices?.[0]?.message;

            if (!message) {
              throw new Error("No message from OpenRouter");
            }

            // Check if images array exists and has content
            if (message.images && message.images.length > 0) {
              const imageUrl = message.images[0].image_url?.url;

              if (!imageUrl) {
                throw new Error("No image URL in OpenRouter response");
              }

              if (imageUrl.startsWith("data:image")) {
                const base64Data = imageUrl.split(",")[1];
                const buffer = Buffer.from(base64Data, "base64");
                await ctx.replyWithPhoto(
                  new InputFile(buffer, `image_${Date.now()}.png`),
                  {
                    caption: "Сделано в @aporto_bot",
                  }
                );
              } else if (imageUrl.startsWith("http")) {
                await ctx.replyWithPhoto(imageUrl, {
                  caption: "Сделано в @aporto_bot",
                });
              } else {
                throw new Error("Unknown image URL format");
              }
            } else {
              // Fallback to old content parsing if no images array
              const content = message.content;

              if (!content) {
                throw new Error("No content or images from OpenRouter");
              }

              // Extract Base64 or URL from content
              let imageUrl = "";
              const mdMatch = content.match(/!\[.*?\]\((.*?)\)/);
              if (mdMatch) {
                imageUrl = mdMatch[1];
              } else {
                imageUrl = content.trim();
              }

              if (imageUrl.startsWith("data:image")) {
                const base64Data = imageUrl.split(",")[1];
                const buffer = Buffer.from(base64Data, "base64");
                await ctx.replyWithPhoto(
                  new InputFile(buffer, `image_${Date.now()}.png`),
                  {
                    caption: "Сделано в @aporto_bot",
                  }
                );
              } else if (imageUrl.startsWith("http")) {
                await ctx.replyWithPhoto(imageUrl, {
                  caption: "Сделано в @aporto_bot",
                });
              } else {
                await ctx.reply(
                  `Could not extract image. Response:\n\n${content.substring(0, 200)}...`
                );
              }
            }
            break;
          }

          case "midjourney":
          case "replicate":
          case "other":
            // Placeholder for future implementations
            await ctx.reply(
              "🛠 Интеграция с этим провайдером в процессе настройки."
            );
            break;

          default:
            await ctx.reply("❌ Неизвестный провайдер модели.");
        }
      } catch (error) {
        console.error("Image Gen Error:", error);
        await ctx.reply(
          "Произошла ошибка при генерации изображения. Попробуйте другой запрос."
        );
      }
      return;
    }

    // --- Text Generation Flow ---
    // Resolve API Model ID from DB if available
    const dbModel = CACHED_MODELS?.find((m) => m.modelId === selectedModelId);
    const apiModelId =
      dbModel?.apiModelId || PROVIDER_MAP[selectedModelId] || selectedModelId;
    const realModelId = apiModelId;

    await ctx.replyWithChatAction("typing");

    trackBackendEvent("Model: Request", telegramId, {
      model: realModelId,
      type: "text",
      status: "attempt",
      prompt_length: text.length,
    });

    const response = await generateText({
      model: getLanguageModel(realModelId),
      system: systemPrompt({
        selectedChatModel: realModelId,
        requestHints: {
          latitude: undefined,
          longitude: undefined,
          city: undefined,
          country: undefined,
        },
      }),
      messages: aiMessages,
      tools: {
        generateImage: tool({
          description:
            "Generate an image, picture, or drawing. Use this tool when the user asks to 'draw', 'create', 'generate' or 'make' an image/picture (keywords: нарисуй, создай, сгенерируй, сделай картинку/изображение).",
          inputSchema: z.object({
            prompt: z
              .string()
              .describe("The description of the image to generate"),
          }),
        }),
      },
    });

    // Handle Tool Calls (specifically Image Generation)
    if (response.toolCalls && response.toolCalls.length > 0) {
      const imageToolCall = response.toolCalls.find(
        (tc) => tc.toolName === "generateImage"
      );

      if (imageToolCall) {
        const call = imageToolCall as any;
        const prompt = call.args.prompt;
        const targetModelId = "model_image_nano_banana"; // Default efficient model

        // Check Limits
        const allowed = await checkAndEnforceLimits(
          ctx,
          user,
          1,
          targetModelId
        );
        if (!allowed) {
          return;
        }

        await ctx.replyWithChatAction("upload_photo");
        await ctx.reply(`🎨 Рисую: "${prompt}"...`);

        try {
          const { experimental_generateImage } = await import("ai");
          const { openai } = await import("@ai-sdk/openai");

          // Use Nano Banana (DALL-E 3 disguised or standard)
          // standard openai.image maps to dall-e-3
          const { image } = await experimental_generateImage({
            model: openai.image("dall-e-3"),
            prompt,
            n: 1,
            size: "1024x1024",
            providerOptions: {
              openai: { quality: "standard" },
            },
          });

          if (image?.base64) {
            const buffer = Buffer.from(image.base64, "base64");
            await ctx.replyWithPhoto(
              new InputFile(buffer, `image_${Date.now()}.png`),
              {
                caption: `🎨 ${prompt}\n\nСделано в @aporto_bot`,
              }
            );

            // Track
            trackBackendEvent("Model: Request", user.id.toString(), {
              model: targetModelId,
              type: "image",
              status: "success",
            });
          }
        } catch (e) {
          console.error("Tool Image Gen Error:", e);
          await ctx.reply(
            "Не удалось сгенерировать изображение. Попробуйте еще раз."
          );
        }
        return;
      }
    }

    // 6. Send Response
    let responseText = response.text;

    if (responseText.length > 20_000) {
      responseText = `${responseText.substring(0, 20_000)}\n\n[Message truncated due to length]`;
    }

    const MAX_LENGTH = 4000;

    for (let i = 0; i < responseText.length; i += MAX_LENGTH) {
      await ctx.reply(responseText.substring(i, i + MAX_LENGTH));
    }

    // 7. Save Assistant Message
    const botMessageId = generateUUID();
    await saveMessages({
      messages: [
        {
          id: botMessageId,
          chatId,
          role: "assistant",
          parts: [{ type: "text", text: response.text }],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    if (cost > 0) {
      await ctx.reply(`💸 Списано: ${cost} кр.`, {
        disable_notification: true,
      });
    }
  } catch (error) {
    console.error("Telegram Webhook Error:", error);
    await ctx.reply("Sorry, something went wrong processing your message.");
  }
});

// --- Photo Message Handler ---
bot.on("message:photo", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const caption = ctx.message.caption || ""; // Text accompanying the photo

  try {
    // 0. Drop Stale Updates
    const messageDate = ctx.message.date;
    const now = Math.floor(Date.now() / 1000);

    if (now - messageDate > 60) {
      console.warn(
        `Dropping stale photo update from user ${telegramId} (delay: ${now - messageDate}s)`
      );
      return;
    }

    // 1. Get or Create User
    let [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      [user] = await createTelegramUser(telegramId);
    }

    // 1.1 Idempotency Check
    const isNew = await setLastMessageId(
      user.id,
      ctx.message.message_id.toString()
    );
    if (!isNew) {
      console.warn(
        `Dropping duplicate/concurrent processing for photo message ${ctx.message.message_id}`
      );
      return;
    }

    // Check if user is using an image model
    const selectedModelId = user.selectedModel || "model_gpt4omini";

    // --- COST CALCULATION & ENFORCEMENT ---
    let cost = 10; // Default Vision Cost
    if (selectedModelId.startsWith("model_image_")) {
      // Heuristic for Image Edit cost
      // "gpt-image-1-edit" = 20. default to 20.
      cost = 20;
      // If we want precise mapping:
      // const key = selectedModelId.replace("model_", "").replace(/_/g, "-") + "-edit";
      // cost = FEATURE_COSTS[key] || 20;
    } else {
      cost = FEATURE_COSTS.image_recognition || 10;
    }

    const allowed = await checkAndEnforceLimits(
      ctx,
      user,
      cost,
      selectedModelId
    );
    if (!allowed) {
      return;
    }

    // If it is an image model, proceed with Image Editing flow
    if (selectedModelId.startsWith("model_image_")) {
      const imageModelConfig = IMAGE_MODELS[selectedModelId];

      if (!imageModelConfig || !imageModelConfig.enabled) {
        await ctx.reply("⚠️ Эта модель пока недоступна.");
        return;
      }
      // ... Proceed to image editing (lines 1702+)
    } else {
      // It is a Text Model -> Treat as Vision Request
      // 1. Download photo
      const photo = ctx.message.photo.at(-1);
      if (!photo) {
        await ctx.reply("Не удалось получить изображение.");
        return;
      }

      await ctx.replyWithChatAction("typing");

      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      // 2. Prepare context
      const realModelId = PROVIDER_MAP[selectedModelId] || "openai/gpt-4o-mini";

      trackBackendEvent("Model: Request", telegramId, {
        model: realModelId,
        type: "vision",
        status: "attempt",
        caption_length: caption.length,
      });

      // 3. Generate Text with Vision
      try {
        // We need 'generateText' which is imported at top.

        // Download image to buffer/base64 not strictly needed if we pass URL,
        // but 'ai' sdk often handles URLs. Let's start with URL if possible or fetch.
        // Vercel AI SDK 'user' content can take { type: 'image', image: ... }.
        // image can be URL or base64. Telegram URL might be private/require token?
        // Yes, `fileUrl` contains token. It should be accessible by the server.

        // Get history
        // 4. Find active chat or create new one (Reuse logic or refactor? Copy-paste safe for now)
        const { chats } = await getChatsByUserId({
          id: user.id,
          limit: 1,
          startingAfter: null,
          endingBefore: null,
        });

        let chatId: string;
        if (chats.length > 0) {
          chatId = chats[0].id;
        } else {
          chatId = generateUUID();
          await saveChat({
            id: chatId,
            userId: user.id,
            title: "Telegram Chat",
            visibility: "private",
          });
        }

        // Fetch history
        const history = await getMessagesByChatId({ id: chatId });
        const aiMessages: any[] = history.map((m) => ({
          role: m.role,
          content:
            m.role === "user"
              ? // Simple text mapping for history, preserving images might be complex in this DB schema
                // if parts are not stored fully. Assuming parts has text.
                (m.parts as any[])
                  .map((p) => p.text)
                  .join("\n")
              : (m.parts as any[]).map((p) => p.text).join("\n"),
        }));

        // Fetch image to pass as Uint8Array or Buffer to be safe?
        // AI SDK supports fetchable URLs.
        const imageResponse = await fetch(fileUrl);
        const imageBuffer = await imageResponse.arrayBuffer();

        const response = await generateText({
          model: getLanguageModel(realModelId),
          messages: [
            ...aiMessages,
            {
              role: "user",
              content: [
                { type: "text", text: caption || "Что на этом изображении?" },
                { type: "image", image: imageBuffer },
              ],
            },
          ],
        });

        const responseText = response.text;

        // Reply
        const MAX_LENGTH = 4000;
        for (let i = 0; i < responseText.length; i += MAX_LENGTH) {
          await ctx.reply(responseText.substring(i, i + MAX_LENGTH));
        }

        // Save
        const userMessageId = generateUUID();
        await saveMessages({
          messages: [
            {
              id: userMessageId,
              chatId,
              role: "user",
              parts: [{ type: "text", text: `[Image] ${caption}` }], // Store as text placeholder for now
              attachments: [],
              createdAt: new Date(),
            },
            {
              id: generateUUID(),
              chatId,
              role: "assistant",
              parts: [{ type: "text", text: responseText }],
              attachments: [],
              createdAt: new Date(),
            },
          ],
        });

        await incrementUserRequestCount(user.id, cost); // Charge for Vision
      } catch (e) {
        console.error("Vision Error:", e);
        await ctx.reply(
          "Произошла ошибка при анализе изображения. Возможно, эта модель не поддерживает зрение."
        );
      }
      return;
    }

    const imageModelConfig = IMAGE_MODELS[selectedModelId];

    if (!imageModelConfig || !imageModelConfig.enabled) {
      await ctx.reply("⚠️ Эта модель пока недоступна.");
      return;
    }

    // Download the photo from Telegram
    const photo = ctx.message.photo.at(-1); // Get largest photo

    if (!photo) {
      await ctx.reply("Не удалось получить изображение.");
      return;
    }

    const file = await ctx.api.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // Download and convert to base64
    const imageResponse = await fetch(fileUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const mimeType = "image/jpeg"; // Telegram usually sends JPEG

    await ctx.replyWithChatAction("upload_photo");
    await ctx.reply(`🎨 Обрабатываю изображение (${imageModelConfig.name})...`);

    // Handle OpenRouter image models
    if (imageModelConfig.provider === "openrouter") {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("Missing OPENROUTER_API_KEY");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aporto.tech",
            "X-Title": "Aporto Bot",
          },
          body: JSON.stringify({
            model: imageModelConfig.id,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${base64Image}`,
                    },
                  },
                  {
                    type: "text",
                    text: caption || "Опиши это изображение",
                  },
                ],
              },
            ],
            modalities: ["image", "text"],
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response.text();
        console.error("OpenRouter API Error:", response.status, err);
        throw new Error(`OpenRouter API Error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      console.log("OpenRouter Photo Response:", JSON.stringify(data, null, 2));

      const message = data.choices?.[0]?.message;

      if (!message) {
        throw new Error("No message from OpenRouter");
      }

      // Check if response contains images
      if (message.images && message.images.length > 0) {
        const imageUrl = message.images[0].image_url?.url;

        if (imageUrl?.startsWith("data:image")) {
          const base64Data = imageUrl.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");
          await ctx.replyWithPhoto(
            new InputFile(buffer, `edited_${Date.now()}.png`),
            {
              caption: "Сделано в @aporto_bot",
            }
          );
        } else if (imageUrl?.startsWith("http")) {
          await ctx.replyWithPhoto(imageUrl, {
            caption: "Сделано в @aporto_bot",
          });
        }
      } else if (message.content) {
        // If no image, send text response
        await ctx.reply(message.content);
      } else {
        throw new Error("No content or images in response");
      }
    } else {
      await ctx.reply("Этот провайдер пока не поддерживает обработку фото.");
      return;
    }
    await incrementUserRequestCount(user.id, cost); // Charge for Image Edit
  } catch (error) {
    console.error("Photo Processing Error:", error);
    await ctx.reply(
      "Произошла ошибка при обработке изображения. Попробуйте позже."
    );
  }
});

export const POST = webhookCallback(bot, "std/http");
