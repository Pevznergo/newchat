import { generateText, tool } from "ai";
import { Bot, InputFile, webhookCallback } from "grammy";
import { z } from "zod";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { IMAGE_MODELS } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  cancelUserSubscription,
  createStarSubscription,
  createTelegramUser,
  createUserConsent,
  getChatsByUserId,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserByTelegramId,
  getUserSubscription,
  hasUserConsented,
  incrementUserRequestCount,
  saveChat,
  saveMessages,
  setLastMessageId,
  updateUserSelectedModel,
} from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

const bot = new Bot(token);

export const maxDuration = 60;

// --- Constants & Helpers ---

const FREE_MODELS = ["model_gpt5mini", "model_gpt4omini", "model_gemini3flash"];

const MODEL_NAMES: Record<string, string> = {
  model_gpt52: "GPT-5.2",
  model_o3: "OpenAI o3",
  model_gpt41: "GPT-4.1",
  model_gpt5mini: "GPT-5 mini",
  model_gpt4omini: "GPT-4o mini",
  model_claude45sonnet: "Claude 4.5 Sonnet",
  model_claude45thinking: "Claude 4.5 Thinking",
  model_deepseek32: "DeepSeek-V3.2",
  model_deepseek32thinking: "DeepSeek-V3.2 Thinking",
  model_gemini3pro: "Gemini 3 Pro",
  model_gemini3flash: "Gemini 3 Flash",
  model_perplexity: "Perplexity",
  model_grok41: "Grok 4.1",
  model_deepresearch: "Deep Research",
  model_video_veo: "Veo 3.1",
  model_video_sora: "Sora Video",
  model_video_kling: "Kling AI",
  model_video_pika: "Pika 2.5",
  model_video_hailuo: "Hailuo 2.3",
  model_image_gpt: "Nano Banana",
  model_image_banana: "Nano Banana",
  model_image_midjourney: "Midjourney",
  model_image_flux: "FLUX 2",
};

const PROVIDER_MAP: Record<string, string> = {
  model_gpt52: "openai/gpt-4o", // Fallback until GPT-5.2 is available
  model_o3: "openai/gpt-4o", // Fallback until o3 is available
  model_gpt41: "openai/gpt-4o", // Fallback until GPT-4.1 is available
  model_gpt5mini: "openai/gpt-4o-mini", // Fallback
  model_gpt4omini: "openai/gpt-4o-mini",
  model_claude45sonnet: "anthropic/claude-3-5-sonnet-20240620",
  model_claude45thinking: "anthropic/claude-3-5-sonnet-20240620", // Thinking not yet separate model ID
  model_deepseek32: "deepseek/deepseek-chat",
  model_deepseek32thinking: "deepseek/deepseek-reasoner",
  model_gemini3pro: "google/gemini-1.5-pro-latest",
  model_gemini3flash: "google/gemini-1.5-flash-latest",
  model_perplexity: "openrouter/perplexity/llama-3.1-sonar-large-128k-online",
  model_grok41: "xai/grok-beta", // Using grok-beta or grok-2-latest
  model_deepresearch: "openai/gpt-4o", // Placeholder
  // Image/Video models use default text model for chat context, tool calls handle generation
  model_video_veo: "openai/gpt-4o",
  model_video_sora: "openai/gpt-4o",
  model_video_kling: "openai/gpt-4o",
  model_video_pika: "openai/gpt-4o",
  model_video_hailuo: "openai/gpt-4o",
  model_image_gpt: "openai/chatgpt-image-latest",
  model_image_banana: "openai/gpt-4o",
  model_image_midjourney: "openai/gpt-4o",
  model_image_flux: "openai/gpt-4o",
};

function getModelKeyboard(selectedModel: string) {
  const isSelected = (id: string) => (selectedModel === id ? "✅ " : "");

  return {
    inline_keyboard: [
      [
        {
          text: `${isSelected("model_gpt52")}GPT-5.2`,
          callback_data: "model_gpt52",
        },
        {
          text: `${isSelected("model_o3")}OpenAI o3`,
          callback_data: "model_o3",
        },
        {
          text: `${isSelected("model_gpt41")}GPT-4.1`,
          callback_data: "model_gpt41",
        },
      ],
      [
        {
          text: `${isSelected("model_gpt5mini")}GPT-5 mini`,
          callback_data: "model_gpt5mini",
        },
        {
          text: `${isSelected("model_gpt4omini")}GPT-4o mini`,
          callback_data: "model_gpt4omini",
        },
      ],
      [
        {
          text: `${isSelected("model_claude45sonnet")}Claude 4.5 Sonnet`,
          callback_data: "model_claude45sonnet",
        },
        {
          text: `${isSelected("model_claude45thinking")}Claude 4.5 Thinking`,
          callback_data: "model_claude45thinking",
        },
      ],
      [
        {
          text: `${isSelected("model_deepseek32")}DeepSeek-V3.2`,
          callback_data: "model_deepseek32",
        },
        {
          text: `${isSelected("model_deepseek32thinking")}DeepSeek-V3.2 Thinking`,
          callback_data: "model_deepseek32thinking",
        },
      ],
      [
        {
          text: `${isSelected("model_gemini3pro")}Gemini 3 Pro`,
          callback_data: "model_gemini3pro",
        },
        {
          text: `${isSelected("model_gemini3flash")}Gemini 3 Flash`,
          callback_data: "model_gemini3flash",
        },
      ],
      [{ text: "⬅️ Назад", callback_data: "menu_start" }],
    ],
  };
}

function getImageModelKeyboard(selectedModel?: string) {
  const buttons = Object.entries(IMAGE_MODELS).map(([key, model]) => {
    const isSelected = selectedModel === key;
    const status = model.enabled ? (isSelected ? "✅" : "") : "🔒";
    return [
      {
        text: `${status} ${model.name} ${model.enabled ? "" : "(Скоро)"}`,
        callback_data: key,
      },
    ];
  });

  buttons.push([{ text: "🔙 Назад", callback_data: "menu_start" }]);

  return { inline_keyboard: buttons };
}

function getVideoModelKeyboard(selectedModel: string) {
  const isSelected = (id: string) => (selectedModel === id ? "✅ " : "");

  return {
    inline_keyboard: [
      [
        {
          text: `${isSelected("model_video_veo")}🪼 Veo 3.1`,
          callback_data: "model_video_veo",
        },
        {
          text: `${isSelected("model_video_sora")}☁️ Sora 2`,
          callback_data: "model_video_sora",
        },
      ],
      [
        {
          text: `${isSelected("model_video_kling")}🐼 Kling`,
          callback_data: "model_video_kling",
        },
        {
          text: `${isSelected("model_video_pika")}🐰 Pika`,
          callback_data: "model_video_pika",
        },
      ],
      [
        {
          text: `${isSelected("model_video_hailuo")}🦊 Hailuo`,
          callback_data: "model_video_hailuo",
        },
      ],
      [{ text: "Закрыть", callback_data: "menu_close" }],
    ],
  };
}

function getSearchModelKeyboard(selectedModel: string) {
  const isSelected = (id: string) => (selectedModel === id ? "✅ " : "");

  return {
    inline_keyboard: [
      [
        {
          text: `${isSelected("model_perplexity")}Perplexity`,
          callback_data: "model_perplexity",
        },
        {
          text: `${isSelected("model_gpt52")}GPT 5.2`,
          callback_data: "model_gpt52",
        },
      ],
      [
        {
          text: `${isSelected("model_gemini3pro")}Gemini 3.0 Pro`,
          callback_data: "model_gemini3pro",
        },
        {
          text: `${isSelected("model_gemini3flash")}Gemini 3.0 Flash`,
          callback_data: "model_gemini3flash",
        },
      ],
      [{ text: "Закрыть", callback_data: "menu_close" }],
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

async function createYookassaPayment(
  amount: number,
  description: string,
  telegramId: string,
  tariffSlug: string
) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    console.error("Missing YooKassa credentials");
    return null;
  }

  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const idempotencyKey = generateUUID();

  try {
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
        "Idempotence-Key": idempotencyKey,
      },
      body: JSON.stringify({
        amount: {
          value: amount.toFixed(2),
          currency: "RUB",
        },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: "https://aporto.tech/api/payment/return",
        },
        description,
        metadata: {
          telegram_id: telegramId,
          tariff_slug: tariffSlug,
        },
        save_payment_method: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("YooKassa Error:", errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("YooKassa Fetch Error:", error);
    return null;
  }
}

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

// --- Menu Helpers ---

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
    reply_markup: getModelKeyboard(currentModel),
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
    : "model_image_gpt";

  await ctx.reply("Выберите модель для создания изображений:", {
    reply_markup: getImageModelKeyboard(currentModel),
  });
}

async function showSearchMenu(ctx: any, user: any) {
  const currentModel = user?.selectedModel || "model_gemini3pro";

  const searchText = `Выберите модель поиска:

ℹ️ Режим Deep Research готовит детально проработанные ответы

Отправьте ваш запрос в чат 👇`;

  await ctx.reply(searchText, {
    reply_markup: getSearchModelKeyboard(currentModel),
  });
}

async function showVideoMenu(ctx: any, user: any) {
  const currentModel = user?.selectedModel?.startsWith("model_video_")
    ? user.selectedModel
    : "model_video_veo";

  const videoMenuText = `Выберите сервис для создания ролика:

🎬 Veo 3.1, Sora 2, Kling, Pika и Hailuo создают видео по описанию или изображению`;

  await ctx.reply(videoMenuText, {
    reply_markup: getVideoModelKeyboard(currentModel),
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

async function showPremiumMenu(ctx: any) {
  const premiumMenuText = `Бот открывает доступ к лучшим AI-сервисам на одной платформе:

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
🌅 Nano Banana Pro | GPT Image 1.5
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
Стоимость: от 350 ₽

<b>ВИДЕО | ПАКЕТ</b>
От 2 до 50 генераций (на выбор)
🎬 Veo 3.1 | Sora 2 | Kling | Hailuo | Pika
✅ Видео на основе изображений
✅ Креативные видео-эффекты
Стоимость: от 225 ₽

<b>ПЕСНИ SUNO | ПАКЕТ</b>
От 20 до 100 генераций (на выбор)
🎸 Нейросеть /Suno V5
✅ Свои стихи или генерация с AI
Стоимость: от 350 ₽

💬 По вопросам оплаты: @GoPevzner`;

  await ctx.reply(premiumMenuText, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: getPremiumKeyboard(),
  });
}

async function showAccountInfo(ctx: any, user: any) {
  const text = `👤 Мой профиль:
ID: ${user?.id || "N/A"}
Telegram: ${user?.telegramId || "N/A"}
Модель: ${user?.selectedModel || "model_gpt4omini"}
Статус: ${user?.hasPaid ? "Premium 🚀" : "Free ✨"}`;
  await ctx.reply(text);
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
    await ctx.answerCallbackQuery();
    return;
  }

  // Handle model selection
  if (data.startsWith("model_")) {
    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    const isFreeModel = FREE_MODELS.includes(data);

    // Premium check
    if (!user.hasPaid && !isFreeModel) {
      const modelName = MODEL_NAMES[data] || "Selected Model";
      await ctx.answerCallbackQuery({
        text: `💎 ${modelName} доступна в Premium`,
        show_alert: true,
      });
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

    // Determine which keyboard to use based on model type
    try {
      let keyboard: { inline_keyboard: any[][] };
      if (data.startsWith("model_image_")) {
        keyboard = getImageModelKeyboard(data);
      } else if (data.startsWith("model_video_")) {
        keyboard = getVideoModelKeyboard(data);
      } else if (
        ["model_perplexity", "model_grok41", "model_deepresearch"].includes(
          data
        )
      ) {
        keyboard = getSearchModelKeyboard(data);
      } else {
        keyboard = getModelKeyboard(data);
      }

      await ctx.editMessageReplyMarkup({
        reply_markup: keyboard,
      });
      await ctx.answerCallbackQuery("Модель выбрана!");
    } catch (_e) {
      await ctx.answerCallbackQuery();
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
        : "model_image_gpt";

      await ctx.reply("Выберите модель для создания изображений:", {
        reply_markup: getImageModelKeyboard(currentModel),
      });
      await ctx.answerCallbackQuery("Условия приняты!");
    } catch (e) {
      console.error("Consent error:", e);
      await ctx.answerCallbackQuery({
        text: "Ошибка сохранения согласия. Попробуйте позже.",
        show_alert: true,
      });
    }
    return;
  }

  // Handle premium menu navigation
  if (data === "buy_premium") {
    await ctx.editMessageReplyMarkup({
      reply_markup: getSubscriptionKeyboard("premium"),
    });
    await ctx.answerCallbackQuery();
    return;
  }
  if (data === "buy_premium_x2") {
    await ctx.editMessageReplyMarkup({
      reply_markup: getSubscriptionKeyboard("premium_x2"),
    });
    await ctx.answerCallbackQuery();
    return;
  }
  if (data === "premium_back") {
    await ctx.editMessageReplyMarkup({ reply_markup: getPremiumKeyboard() });
    await ctx.answerCallbackQuery();
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
        await ctx.answerCallbackQuery("Error: Price not found");
        return;
      }

      await ctx.answerCallbackQuery("Создаю инвойс...");
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
      await ctx.answerCallbackQuery("Error: Invalid plan");
      return;
    }

    await ctx.answerCallbackQuery("Создаю счет...");

    const payment = await createYookassaPayment(
      price,
      description,
      telegramId,
      tariffSlug
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

      await ctx.reply(messageText, {
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
      });
    } else {
      await ctx.reply(
        "❌ Ошибка создания платежа. Попробуйте позже или свяжитесь с поддержкой."
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
    await ctx.answerCallbackQuery("В разработке...");
    await ctx.reply(
      "Выбор пакетов (Video, MJ, Suno) скоро появится. Пока доступна только подписка Premium."
    );
    return;
  }

  await ctx.answerCallbackQuery();
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

    // B. Message Count Limit
    const messageCount = await getMessageCountByUserId({
      id: user.id,
      differenceInHours: 24,
    });

    if (messageCount >= entitlements.maxMessagesPerDay && userType !== "pro") {
      await ctx.reply(
        "Ой, дневной лимит сообщений исчерпан! 🛑\n\nНо это не конец! 🚀\nПереходите на **PRO-тариф** для безлимитного общения или испытайте удачу в **Колесе Фортуны** 🎡 — там можно выиграть дополнительные токены, подписку и другие призы.\n\nВозвращайтесь к общению без границ!"
      );
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

    await incrementUserRequestCount(user.id);

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
                        callback_data: "buy_premium",
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
                  caption: `🖼 ${text}\n\nGenerated by ${imageModelConfig.name} (@aporto_bot)`,
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
                    caption: `🖼 ${text}\n\nGenerated by ${imageModelConfig.name} (@aporto_bot)`,
                  }
                );
              } else if (imageUrl.startsWith("http")) {
                await ctx.replyWithPhoto(imageUrl, {
                  caption: `🖼 ${text}\n\nGenerated by ${imageModelConfig.name} (@aporto_bot)`,
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
                    caption: `🖼 ${text}\n\nGenerated by ${imageModelConfig.name} (@aporto_bot)`,
                  }
                );
              } else if (imageUrl.startsWith("http")) {
                await ctx.replyWithPhoto(imageUrl, {
                  caption: `🖼 ${text}\n\nGenerated by ${imageModelConfig.name} (@aporto_bot)`,
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
                      web_app: { url: "https://aporto.tech/app" },
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

export const POST = webhookCallback(bot, "std/http");
