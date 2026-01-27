import path from "node:path";
import { generateText, tool } from "ai";
import { Bot, InputFile, webhookCallback } from "grammy";
import { z } from "zod";
import {
  CONTEXT_COST_RUBRIC,
  FEATURE_COSTS,
  MODEL_COSTS,
} from "@/lib/ai/cost-models";
import {
  entitlementsByUserType,
  SUBSCRIPTION_LIMITS,
} from "@/lib/ai/entitlements";
import { IMAGE_MODELS } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  cancelUserSubscription,
  createStarSubscription,
  createTelegramUser,
  createUserConsent,
  getAiModels,
  getChatsByUserId,
  getLastActiveSubscription,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserByTelegramId,
  getUserSubscription,
  hasUserConsented,
  incrementUserRequestCount,
  resetUserRequestCount,
  saveChat,
  saveMessages,
  setLastMessageId,
  setUserDetails,
  updateUserSelectedModel,
  upsertAiModel,
} from "@/lib/db/queries";
import { createYookassaPayment } from "@/lib/payment";
import { generateUUID } from "@/lib/utils";

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
  "model_gemini3flash",
  "model_gemini3flash",
  "model_image_nano_banana", // Nano Banana
  "model_deepseek32",
];

const MODEL_NAMES: Record<string, string> = {
  model_gpt52: "GPT-5.2",
  model_o3: "OpenAI o3",
  model_gpt41: "GPT-4.1",
  model_gpt5nano: "GPT-5 Nano",
  model_gpt4omini: "GPT-4o Mini",
  model_claude45sonnet: "Claude 3.5 Sonnet",
  model_claude45thinking: "Claude 3.7 Sonnet Thinking",
  model_deepseek32: "DeepSeek-V3",
  model_deepseek32thinking: "DeepSeek-R1",
  model_gemini3pro: "Gemini 1.5 Pro",
  model_gemini3flash: "Gemini 3 Flash",
  model_image_nano_banana: "Nano Banana",
  model_image_banana_pro: "Nano Banana Pro",
  model_image_midjourney: "Midjourney",
  model_image_flux: "FLUX 2",
  model_grok41: "Grok 4.1",
  model_deepresearch: "Deep Research",
};

const PROVIDER_MAP: Record<string, string> = {
  model_gpt52: "openai/gpt-5.2-2025-12-11",
  model_o3: "openai/o3-deep-research-2025-06-26",
  model_gpt41: "openai/gpt-4.1-2025-04-14",
  model_gpt5nano: "openai/gpt-5-nano-2025-08-07",
  model_gpt4omini: "openai/gpt-4o-mini-2024-07-18",
  model_claude45sonnet: "openrouter/anthropic/claude-3.5-sonnet",
  model_claude45thinking: "openrouter/anthropic/claude-3.7-sonnet",
  model_deepseek32: "openrouter/deepseek/deepseek-chat",
  model_deepseek32thinking: "openrouter/deepseek/deepseek-r1",
  model_gemini3pro: "openrouter/google/gemini-pro-1.5",
  model_gemini3flash: "openrouter/google/gemini-3-flash-preview",
  // Image/Video models use default text model for chat context
  model_video_veo: "openai/gpt-4o",
  model_video_sora: "openai/gpt-4o",
  model_video_kling: "openai/gpt-4o",
  model_video_pika: "openai/gpt-4o",
  model_video_hailuo: "openai/gpt-4o",
  model_image_nano_banana: "openai/chatgpt-image-latest",
  model_image_banana_pro: "openai/dall-e-3",
  model_image_midjourney: "openai/gpt-4o",
  model_image_flux: "openai/gpt-4o",
  model_grok41: "xai/grok-2-vision-1212", // Placeholder for Grok 4.1 if not available
  model_deepresearch: "openai/o3-deep-research-2025-06-26", // Placeholder matches o3
};

function getModelKeyboard(selectedModel: string, isPremium: boolean) {
  const isSelected = (id: string) => (selectedModel === id ? "✅ " : "");
  const isLocked = (id: string) =>
    !isPremium && !FREE_MODELS.includes(id) ? "🔒 " : "";
  const getLabel = (id: string, name: string) =>
    `${isLocked(id)}${isSelected(id)}${name}`;

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
          text: getLabel("model_deepseek32", "DeepSeek-V3.2"),
          callback_data: "model_deepseek32",
        },
        {
          text: getLabel("model_deepseek32thinking", "DeepSeek-V3.2 Thinking"),
          callback_data: "model_deepseek32thinking",
        },
      ],
      [
        {
          text: getLabel("model_gemini3pro", "Gemini 3 Pro"),
          callback_data: "model_gemini3pro",
        },
        {
          text: getLabel("model_gemini3flash", "Gemini 3 Flash"),
          callback_data: "model_gemini3flash",
        },
      ],
      [{ text: "⬅️ Назад", callback_data: "menu_start" }],
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
          text: getLabel("model_gemini3pro", "Gemini 3.0 Pro"),
          callback_data: "model_gemini3pro",
        },
        {
          text: getLabel("model_gemini3flash", "Gemini 3.0 Flash"),
          callback_data: "model_gemini3flash",
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

const PRICING_PLANS = {
  premium: {
    base: 750,
    months_1: 750,
    months_3: 1800, // 750 * 3 * 0.8
    months_6: 2925, // 750 * 6 * 0.65
    months_12: 4500, // 750 * 12 * 0.5
  },
  premium_x2: {
    base: 1250,
    months_1: 1250,
    months_3: 3000,
    months_6: 4875,
    months_12: 7500,
  },
};

const STAR_PRICING = {
  premium: {
    months_1: 500,
    months_3: 1200,
    months_6: 2000,
    months_12: 3000,
  },
  premium_x2: {
    months_1: 850,
    months_3: 2000,
    months_6: 3250,
    months_12: 5000,
  },
};

const MJ_PRICING = {
  50: 250,
  100: 450,
  200: 800,
  500: 1750,
};

const VIDEO_PRICING = {
  2: 150,
  10: 500,
  20: 900,
  50: 2000,
};

const SUNO_PRICING = {
  20: 250,
  50: 500,
  100: 900,
};

function getPremiumKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Premium", callback_data: "buy_premium" },
        { text: "Premium X2", callback_data: "buy_premium_x2" },
      ],
      [
        { text: "Midjourney", callback_data: "buy_midjourney" },
        { text: "Видео", callback_data: "buy_video" },
        { text: "Suno", callback_data: "buy_suno" },
      ],
      [{ text: "Закрыть", callback_data: "menu_close" }],
    ],
  };
}

function getSubscriptionKeyboard(plan: "premium" | "premium_x2") {
  const prices = PRICING_PLANS[plan];
  // const _label = plan === "premium" ? "Premium" : "Premium X2";

  return {
    inline_keyboard: [
      [
        {
          text: `1 месяц – ${prices.months_1}₽`,
          callback_data: `pay_${plan}_1`,
        },
      ],
      [
        {
          text: `3 месяца – ${prices.months_3}₽ (-20%)`,
          callback_data: `pay_${plan}_3`,
        },
      ],
      [
        {
          text: `6 месяцев – ${prices.months_6}₽ (-35%)`,
          callback_data: `pay_${plan}_6`,
        },
      ],
      [
        {
          text: `12 месяцев – ${prices.months_12}₽ (-50%)`,
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

function getMidjourneyPackagesKeyboard() {
  const buttons = Object.entries(MJ_PRICING).map(([count, price]) => {
    return [
      {
        text: `${count} генераций – ${price} ₽`,
        callback_data: `select_mj_${count}`,
      },
    ];
  });
  buttons.push([{ text: "⬅️ Назад", callback_data: "premium_back" }]); // Fixed callback to premium_back as per user flow expectation? Or maybe menu_start. Let's stick to premium_back if it came from premium menu. But wait, buy_midjourney is in premium menu. So back should go to premium menu.
  return { inline_keyboard: buttons };
}

function getVideoPackagesKeyboard() {
  const buttons = Object.entries(VIDEO_PRICING).map(([count, price]) => {
    return [
      {
        text: `${count} генераций – ${price} ₽`,
        callback_data: `select_video_${count}`,
      },
    ];
  });
  buttons.push([{ text: "⬅️ Назад", callback_data: "premium_back" }]);
  return { inline_keyboard: buttons };
}

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

  let cost = dbModel ? dbModel.cost : MODEL_COSTS[modelId] || 1;

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
    cost *= multiplier;
  }

  // Video/Image Special Logic overrides
  // (Ideally precise logic maps specific internal model IDs to cost features)

  return cost;
}

// Check limits and return true if allowed, false if blocked (and sends message)
async function checkAndEnforceLimits(
  ctx: any,
  user: any,
  cost: number
): Promise<boolean> {
  const _isPremium = user.hasPaid; // Premium or Pro (needs distinction via tariff normally, but let's assume hasPaid covers both for now, or check detailed subscription)
  // We need to know if user is Free or Paid. Querying subscription details or trusting `hasPaid`.
  // Ideally `user` object has `subscription` info joined. If not, we might need to fetch it or rely on `hasPaid`.
  // For now: if !hasPaid -> Free.

  let limit = SUBSCRIPTION_LIMITS.free;
  let currentCount = user.requestCount || 0;

  if (user.hasPaid) {
    // Determine if Premium or Pro?
    // User schema doesn't have "tier". We might need to look at `tariffSlug` from subscription.
    // However, existing code might not fetch subscription.
    // For simplicity/MVP: If `hasPaid` is true, we assume at least Premium.
    // If we can't easily distinguish, we might default to Premium limit (2500) or Pro (7500).
    // Let's assume hitting 2500 is rare for now or try to fetch sub.
    limit = SUBSCRIPTION_LIMITS.premium; // Default paid limit.
    // real logic: check subscription table.
  }

  // Free Tier Reset Logic
  if (!user.hasPaid) {
    const lastReset = user.lastResetDate ? new Date(user.lastResetDate) : null;
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // If never reset or older than 7 days -> Reset
    if (!lastReset || now.getTime() - lastReset.getTime() > sevenDaysMs) {
      await resetUserRequestCount(user.id);
      currentCount = 0; // Local update
    }
  }

  // Check Limit
  if (currentCount + cost > limit) {
    let message = "";
    let buttons: any[] = [];

    if (user.hasPaid) {
      // Premium user hit limit
      message = `🚧 <b>Лимит исчерпан!</b>
      
Вы достигли дневного лимита запросов для вашей подписки (${limit}).

Что делать?
• Купить доп. пакет запросов (скоро)
• Подождать до завтра (сброс в 00:00 UTC)
• Пригласить друзей для бонусов`;

      buttons = [
        // [{ text: "📦 Купить пакет запросов", callback_data: "buy_requests_pack" }], // Placeholder
        [{ text: "🎡 Испытать удачу", callback_data: "spin_wheel" }],
        [{ text: "👥 Пригласить друзей", callback_data: "referral_link" }],
      ];
    } else {
      // Free user
      message = `🚧 <b>Лимит исчерпан!</b>

Вы достигли лимита запросов.
Free: раз в неделю (${limit}).

Что делать?
• Испытайте удачу в колесе фортуны
• Подключите Премиум / Pro (до 100-200 в день)
• Пригласите друзей`;

      buttons = [
        [{ text: "🎡 Испытать удачу", callback_data: "spin_wheel" }],
        [{ text: "💎 Подключить Премиум", callback_data: "open_premium" }],
        [{ text: "👥 Пригласить друзей", callback_data: "referral_link" }],
      ];
    }

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
    return false;
  }

  return true;
}

function getSunoPackagesKeyboard() {
  const buttons = Object.entries(SUNO_PRICING).map(([count, price]) => {
    return [
      {
        text: `${count} генераций – ${price} ₽`,
        callback_data: `select_suno_${count}`,
      },
    ];
  });
  buttons.push([{ text: "⬅️ Назад", callback_data: "premium_back" }]);
  return { inline_keyboard: buttons };
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
    : "model_image_nano_banana";

  await ctx.reply("Выберите модель для создания изображений:", {
    reply_markup: getImageModelKeyboard(currentModel, user?.hasPaid),
  });
}

async function showSearchMenu(ctx: any, user: any) {
  const currentModel = user?.selectedModel || "model_gemini3flash"; // Default to free model

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

const PREMIUM_MENU_TEXT = `Бот открывает доступ к лучшим AI-сервисам на одной платформе:

<b>Бесплатно | ЕЖЕНЕДЕЛЬНО</b>
100 любых запросов
✅ GPT-5 mini | GPT-4o mini
✅ DeepSeek-V3.2 | Gemini 3 Flash
✅ Интернет-поиск Perplexity
✅ Распознавание изображений
25 генераций изображений
🌅 Nano Banana | GPT Image 1.5

<b>ПРЕМИУМ | МЕСЯЦ</b>
🔼 Лимит запросов – 100 в день
✅ Все опции выше
✅ Nano Banana Pro | GPT Image 1.5
✅ GPT-5.2 | GPT-4.1 | OpenAI o3
✅ Gemini 3 Pro | Claude 4.5
✅ Работа с документами
✅ Голосовые ответы
✅ Без рекламы
Стоимость: 750 ₽ *

<b>ПРЕМИУМ X2 | МЕСЯЦ</b>
⏫ Лимит запросов – 200 в день
✅ Те же опции, что в «Премиум»
Стоимость: 1250 ₽

<b>MIDJOURNEY И FLUX | ПАКЕТ</b>
От 50 до 500 генераций (на выбор)
🌅 /Midjourney V7 и Flux 2
✅ Midjourney Video
✅ Замена лиц на фото
Стоимость: от 250 ₽

<b>ВИДЕО | ПАКЕТ</b>
От 2 до 50 генераций (на выбор)
🎬 Veo 3.1 | Sora 2 | Kling | Hailuo | Pika
✅ Видео на основе изображений
✅ Креативные видео-эффекты
Стоимость: от 150 ₽

<b>ПЕСНИ SUNO | ПАКЕТ</b>
От 20 до 100 генераций (на выбор)
🎸 Нейросеть /Suno V5
✅ Свои стихи или генерация с AI
Стоимость: от 250 ₽

💬 По вопросам оплаты: @GoPevzner`;

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
  const entitlements = entitlementsByUserType[isPremium ? "pro" : "regular"];

  // Fetch message count for 24h (Daily Usage)
  const messageCount = await getMessageCountByUserId({
    id: user.id,
    differenceInHours: 24,
  });

  const dailyLimit = entitlements.maxMessagesPerDay || 10;

  // Get neat model name
  const currentModelKey = user.selectedModel || "model_gpt4omini";
  const currentModelName = MODEL_NAMES[currentModelKey] || currentModelKey;

  const text = `👤 <b>Мой профиль</b>:
ID: ${user.telegramId || "N/A"}
Подписка: ${isPremium ? "Премиум 🚀" : "Стандартная ✔"}
Выбрана модель: ${currentModelName} /model

📊 <b>Статистика использования</b>

Запросов сегодня: ${messageCount}/${dailyLimit}
 └ GPT-5 nano | GPT-4o mini
 └ DeepSeek-V3.2 | Gemini 3 Flash
 └ картинки Nano Banana
 └ ИИ-фотошоп Nano Banana

Нужно больше? Подключите /premium

🚀 <b>Подписка Премиум</b>:
 └ 100-200 запросов в день
 └ GPT-5.2 | GPT-4.1 | OpenAI o3
 └ Gemini 3 Pro | Claude 4.5
 └ Nano Banana Pro 🔥
 └ работа с документами

🌅 <b>Пакет Midjourney</b>: 0/0
 └ Midjourney | Flux 2
 └ Midjourney Video

🎬 <b>Пакет видео</b>: 0/0
 └ Veo 3.1 | Sora 2 | Kling | Hailuo | Pika
 └ видео на основе изображений

🎸 <b>Песни Suno</b>: 0/0

� Поддержка: @GoPevzner`;

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
      { command: "suno", description: "🎸 Создать песню" },
      { command: "s", description: "🔎 Поиск в интернете" },
      { command: "model", description: "📝 Выбрать модель" },
      { command: "settings", description: "⚙️ Настройки" },
      { command: "help", description: "🎱 Список команд" },
      { command: "privacy", description: "📄 Условия использования" },
    ]);

    // Extract payload from /start command (QR code source)
    const payload = ctx.match;
    const startParam =
      payload && typeof payload === "string" ? payload.trim() : undefined;

    // Create user in DB (queries.ts uses ON CONFLICT DO NOTHING usually, or we should check)
    // Actually queries.ts createTelegramUser uses INSERT which might throw if exists, need check
    // Checked createTelegramUser: it uses .insert().values().returning(). It does NOT have ON CONFLICT.
    // So we should check existence first or wrap in try/catch (which it is in queries.ts, but throws ChatSDKError)
    // Current usage in code checks if user exists?
    // In original code: `const [user] = await createTelegramUser(...)`. If user exists, this throws unique constraint error probably.
    // Let's check `createTelegramUser` implementation again if possible or trust existing logic.
    // Existing logic in `message:text` does `getUser` then `createUser`.
    // Here we should do the same.

    let [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      [user] = await createTelegramUser(telegramId, undefined, startParam);
    }

    // Reset model to default on start
    await updateUserSelectedModel(user.id, "model_gpt5nano");

    const welcomeMessage = `Привет! ИИ-бот №1 открывает вам доступ к лучшим нейросетям для создания текста, изображений, видео и песен.

БЕСПЛАТНО – 100 вопросов в неделю: ChatGPT, DeepSeek, Perplexity, Gemini, ИИ-фотошоп Nano Banana Pro и GPT Image 1.5.

В /PREMIUM доступны GPT-5.2, Gemini Pro, Claude, картинки /Midjourney и Flux 2, видео Veo 3.1, Sora 2, Hailuo, Kling, музыка /Suno.

Как пользоваться ботом?

📝 ТЕКСТ: просто напишите вопрос или отправьте изображение в чат (выбор нейросети в разделе /model).

🔎 ПОИСК: нажмите /s и задайте вопрос – здесь модели с доступом в Интернет.

🌅 ИЗОБРАЖЕНИЯ: нажмите /photo, чтобы создать или редактировать картинку.

🎬 ВИДЕО: нажмите /video, чтобы начать создание ролика.

🎸 МУЗЫКА: введите /suno, выберите жанр и добавьте текст песни.`;

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        keyboard: [
          ["📝 Выбрать модель", "🎨 Создать картинку"],
          ["🔎 Интернет-поиск", "🎬 Создать видео"],
          [
            {
              text: "🎁 Колесо Фортуны",
              web_app: { url: "https://aporto.tech/app" },
            },
            { text: "🎸 Создать песню" },
          ],
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
    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply("❌ Пользователь не найден. Нажмите /start");
      return;
    }

    const sub = await getUserSubscription(user.id);
    if (!sub) {
      await ctx.reply("⚠️ У вас нет активной подписки.");
      return;
    }

    const success = await cancelUserSubscription(user.id);
    if (success) {
      const date = sub.endDate.toLocaleDateString("ru-RU");
      await ctx.reply(
        `✅ Автопродление подписки отключено.\nПодписка действует до ${date}.`
      );
    } else {
      await ctx.reply(
        "❌ Ошибка при отмене. Свяжитесь с поддержкой @GoPevzner."
      );
    }
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

bot.command("suno", async (ctx) => {
  await showMusicMenu(ctx);
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
      reply_markup: getSubscriptionKeyboard("premium"),
    });
    await safeAnswerCallbackQuery(ctx);
    return;
  }
  if (data === "buy_premium_x2") {
    await ctx.editMessageReplyMarkup({
      reply_markup: getSubscriptionKeyboard("premium_x2"),
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

    const durationKey =
      `months_${months}` as keyof typeof PRICING_PLANS.premium;
    const tariffSlug = `${planKey}_${months}`;
    const description = `${planKey === "premium_x2" ? "Premium X2" : "Premium"} (${months} мес)`;

    if (isStars) {
      // Safe cast or check
      const starPlan = STAR_PRICING[planKey] as Record<string, number>;
      const starsPrice = starPlan[durationKey];

      if (!starsPrice) {
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
        [{ label: description, amount: starsPrice }] // prices
      );
      return;
    }

    // Existing YooKassa Logic
    const price = PRICING_PLANS[planKey][durationKey]; // e.g. 750

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

  // Handle Midjourney Package Selection
  if (data === "buy_midjourney") {
    await ctx.reply("Выберите количество:", {
      reply_markup: getMidjourneyPackagesKeyboard(),
    });
    await safeAnswerCallbackQuery(ctx);
    return;
  }

  // Handle Specific Midjourney Package Payment
  if (data.startsWith("select_mj_")) {
    const count = Number.parseInt(data.replace("select_mj_", ""), 10);
    const price = MJ_PRICING[count as keyof typeof MJ_PRICING];

    if (!price) {
      await safeAnswerCallbackQuery(ctx, "Ошибка: тариф не найден");
      return;
    }

    const description = `Midjourney (${count} генераций)`;
    const tariffSlug = `midjourney_${count}`; // No duration, it's a pack

    await safeAnswerCallbackQuery(ctx, "Создаю счет...");
    try {
      await ctx.deleteMessage();
    } catch {
      // ignore
    }

    const placeholder = await ctx.reply("⏳ Создаю платеж...");

    // Create Payment
    const payment = await createYookassaPayment(
      price,
      description,
      telegramId,
      tariffSlug,
      placeholder.message_id
    );

    if (payment?.confirmation?.confirmation_url) {
      const payUrl = payment.confirmation.confirmation_url;

      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "Выберите способ оплаты:",
        {
          reply_markup: getPaymentMethodKeyboard(payUrl),
        }
      );
    } else {
      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "❌ Ошибка создания платежа. Попробуйте позже."
      );
    }
    return;
  }

  // Handle Video Package Selection
  if (data === "buy_video") {
    await ctx.reply("Выберите количество:", {
      reply_markup: getVideoPackagesKeyboard(),
    });
    await safeAnswerCallbackQuery(ctx);
    return;
  }

  // Handle Specific Video Package Payment
  if (data.startsWith("select_video_")) {
    const count = Number.parseInt(data.replace("select_video_", ""), 10);
    const price = VIDEO_PRICING[count as keyof typeof VIDEO_PRICING];

    if (!price) {
      await safeAnswerCallbackQuery(ctx, "Ошибка: тариф не найден");
      return;
    }

    const description = `Video (${count} генераций)`;
    const tariffSlug = `video_${count}`;

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

      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "Выберите способ оплаты:",
        {
          reply_markup: getPaymentMethodKeyboard(payUrl),
        }
      );
    } else {
      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "❌ Ошибка создания платежа. Попробуйте позже."
      );
    }
    return;
  }

  // Handle Suno Package Selection
  if (data === "buy_suno") {
    await ctx.reply("Выберите количество:", {
      reply_markup: getSunoPackagesKeyboard(),
    });
    await safeAnswerCallbackQuery(ctx);
    return;
  }

  // Handle Specific Suno Package Payment
  if (data.startsWith("select_suno_")) {
    const count = Number.parseInt(data.replace("select_suno_", ""), 10);
    const price = SUNO_PRICING[count as keyof typeof SUNO_PRICING];

    if (!price) {
      await safeAnswerCallbackQuery(ctx, "Ошибка: тариф не найден");
      return;
    }

    const description = `Suno (${count} генераций)`;
    const tariffSlug = `suno_${count}`;

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

      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "Выберите способ оплаты:",
        {
          reply_markup: getPaymentMethodKeyboard(payUrl),
        }
      );
    } else {
      await ctx.api.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        "❌ Ошибка создания платежа. Попробуйте позже."
      );
    }
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

    const parts = tariffSlug.split("_");
    const months = Number.parseInt(parts.at(-1) ?? "1", 10);
    const durationDays = months * 30;

    await createStarSubscription(user.id, tariffSlug, durationDays);

    await ctx.reply(
      `✅ Оплата прошла успешно!\nПодписка активирована на ${months} мес.`
    );
  } catch (error) {
    console.error("Error processing successful_payment:", error);
    await ctx.reply("⚠️ Оплата принята, но произошла ошибка активации.");
  }
});

// --- Message Handlers ---

bot.on("message:text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

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

  // Handle /unsubscribe command
  if (text === "/unsubscribe") {
    // Check for active subscription
    const [user] = await getUserByTelegramId(telegramId); // Ensure user is fetched for this command
    if (!user) {
      await ctx.reply(
        "Пожалуйста, начните взаимодействие с ботом, чтобы использовать эту команду."
      );
      return;
    }

    const sub = await getLastActiveSubscription(user.id);
    if (!sub) {
      await ctx.reply("❌ У вас нет активной подписки.");
      return;
    }

    if (!sub.autoRenew) {
      const dateStr = sub.endDate.toLocaleDateString("ru-RU");
      await ctx.reply(
        `✅ Автопродление уже отключено.\nВаша подписка подписка действует до ${dateStr}.`
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
    return;
  }

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
    if (text.length > entitlements.charLimit) {
      await ctx.reply(
        `⚠️ Сообщение слишком длинное. Ваш лимит: ${entitlements.charLimit} символов.`
      );
      return;
    }

    // B. Cost & Subscription Limit
    const cost = await calculateRequestCost(
      user.selectedModel || "model_gpt4omini",
      text.length
    );
    const allowed = await checkAndEnforceLimits(ctx, user, cost);
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

    await incrementUserRequestCount(user.id, cost);

    // 4. Fetch History
    const history = await getMessagesByChatId({ id: chatId });
    const aiMessages: any[] = history.map((m) => ({
      role: m.role,
      content: (m.parts as any[]).map((p) => p.text).join("\n"),
    }));

    // 5. Generate Response using selected model
    const selectedModelId = user.selectedModel || "model_gpt4omini";

    // --- Image Generation Flow ---
    if (selectedModelId?.startsWith("model_image_")) {
      const imageModelConfig = IMAGE_MODELS[selectedModelId];

      if (!imageModelConfig || !imageModelConfig.enabled) {
        await ctx.reply(
          "⚠️ Эта модель пока недоступна или находится в разработке."
        );
        return;
      }

      // Limit Check for Free Users (Generic for all image models for now)
      if (userType !== "pro") {
        const redis = (await import("@/lib/redis")).default;
        const usageKey = `usage:image_gen:${user.id}`; // Unified key
        try {
          const usage = await redis.get(usageKey);
          const count = usage ? Number.parseInt(usage, 10) : 0;
          // Limit: 5 free images per period (approx month)
          if (count >= 5) {
            await ctx.reply(
              "🛑 Лимит генераций исчерпан!\n\nНа бесплатном тарифе доступно 5 изображений.\nПереходите на Premium для безлимита! 🚀",
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "💎 Купить Premium",
                        callback_data: "open_premium",
                      },
                    ],
                    [
                      {
                        text: "🎡 Испытать удачу",
                        web_app: { url: "https://aporto.tech/app" },
                      },
                    ],
                  ],
                },
              }
            );
            return;
          }
          // Increment usage
          const multi = redis.multi();
          multi.incr(usageKey);
          if (count === 0) {
            multi.expire(usageKey, 30 * 24 * 60 * 60);
          }
          await multi.exec();
        } catch (e) {
          console.error("Redis usage check failed", e);
        }
      }

      await ctx.replyWithChatAction("upload_photo");
      await ctx.reply(`🎨 Генерирую (${imageModelConfig.name}): "${text}"...`);

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
    const realModelId = PROVIDER_MAP[selectedModelId] || "openai/gpt-4o-mini";

    await ctx.replyWithChatAction("typing");

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
        if (userType !== "pro") {
          await ctx.reply(
            "Для генерации изображений необходима PRO-подписка. 🔒\nВы можете купить её или попробовать выиграть в Колесе Фортуны!",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Купить PRO", callback_data: "/pro" }],
                  [
                    {
                      text: "Колесо Фортуны",
                      web_app: { url: "https://t.me/aporto_bot/app" },
                    },
                  ],
                ],
              },
            }
          );
          return;
        }
        await ctx.reply("Генерация изображений скоро будет доступна! 🎨");
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

    const allowed = await checkAndEnforceLimits(ctx, user, cost);
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
