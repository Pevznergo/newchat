import { generateText, tool } from "ai";
import { z } from "zod";
import { Bot, webhookCallback } from "grammy";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  createTelegramUser,
  createUserConsent,
  getChatsByUserId,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserByTelegramId,
  hasUserConsented,
  incrementUserRequestCount,
  saveChat,
  saveMessages,
  setLastMessageId,
  updateUserPreferences,
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
  model_image_gpt: "GPT Images",
  model_image_banana: "Nano Banana",
  model_image_midjourney: "Midjourney",
  model_image_flux: "FLUX 2",
};

const PROVIDER_MAP: Record<string, string> = {
  model_gpt52: "openai/gpt-4-turbo",
  model_o3: "openai/gpt-4o",
  model_gpt41: "openai/gpt-4-turbo",
  model_gpt5mini: "openai/gpt-4o-mini",
  model_gpt4omini: "openai/gpt-4o-mini",
  model_claude45sonnet: "anthropic/claude-3-5-sonnet-20240620",
  model_claude45thinking: "anthropic/claude-3-5-sonnet-20240620",
  model_deepseek32: "openai/gpt-4o",
  model_deepseek32thinking: "openai/gpt-4o",
  model_gemini3pro: "google/gemini-1.5-pro-latest",
  model_gemini3flash: "google/gemini-1.5-flash-latest",
  model_perplexity: "openai/gpt-4o",
  model_grok41: "openai/gpt-4o",
  model_deepresearch: "openai/gpt-4o",
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

function getImageModelKeyboard(selectedModel: string) {
  const isSelected = (id: string) => (selectedModel === id ? "✅ " : "");

  return {
    inline_keyboard: [
      [
        {
          text: `${isSelected("model_image_gpt")}🌌 GPT Images`,
          callback_data: "model_image_gpt",
        },
        {
          text: `${isSelected("model_image_banana")}🍌 Nano Banana`,
          callback_data: "model_image_banana",
        },
      ],
      [
        {
          text: `${isSelected("model_image_midjourney")}🌅 Midjourney`,
          callback_data: "model_image_midjourney",
        },
        {
          text: `${isSelected("model_image_flux")}🔺 FLUX 2`,
          callback_data: "model_image_flux",
        },
      ],
      [{ text: "Закрыть", callback_data: "menu_close" }],
    ],
  };
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

// --- Commands ---


bot.command("start", async (ctx) => {
  console.log("Received /start command");
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      console.warn("No Telegram ID found in context");
      return;
    }

    // Extract payload from /start command (QR code source)
    const payload = ctx.match;
    const startParam =
      payload && typeof payload === "string" ? payload.trim() : undefined;

    if (startParam) {
      console.log(`User ${telegramId} came from QR source: ${startParam}`);
    }

    const firstName = ctx.from?.first_name || "";
    const username = ctx.from?.username || "";
    const displayName = firstName || username || "Friend";

    console.log(`Processing user: ${telegramId} (${displayName})`);

    let [user] = await getUserByTelegramId(telegramId);
    if (user) {
      console.log("User found:", user.id);
      // User already exists - keep first attribution, no update
    } else {
      console.log("Creating new Telegram user...");
      // Save QR code source on registration (silent tracking)
      [user] = await createTelegramUser(telegramId, undefined, startParam);
      console.log(
        `User created: ${user.id}${startParam ? ` from QR: ${startParam}` : " (direct)"}`
      );
    }

    // Standard welcome message (no mention of QR source)
    const welcomeMessage = `Привет! ИИ-бот №1 открывает вам доступ к лучшим нейросетям для создания текста, изображений, видео и песен.

БЕСПЛАТНО – 100 вопросов в неделю: ChatGPT, DeepSeek, Perplexity, Gemini, ИИ-фотошоп Nano Banana Pro и GPT Image 1.5.

В /PREMIUM доступны GPT-5.2, Gemini Pro, Claude, картинки /Midjourney и Flux 2, видео Veo 3.1, Sora 2, Hailuo, Kling, музыка /Suno.

Как пользоваться ботом?

📝 ТЕКСТ: просто напишите вопрос или отправьте изображение в чат (выбор нейросети в разделе /model).

🔎 ПОИСК: нажмите /s и задайте вопрос – здесь модели с доступом в Интернет.

🌅 ИЗОБРАЖЕНИЯ: нажмите /photo, чтобы создать или редактировать картинку.

🎬 ВИДЕО: нажмите /video, чтобы начать создание ролика.

🎸 МУЗЫКА: введите /chirp, выберите жанр и добавьте текст песни.`;

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        keyboard: [
          [{ text: "📝 Выбрать модель" }, { text: "🎨 Создать картинку" }],
          [{ text: "🔎 Интернет-поиск" }, { text: "🎬 Создать видео" }],
          [
            {
              text: "🎡 Колесо Фортуны",
              web_app: { url: "https://t.me/aporto_bot/app" },
            },
            { text: "🎸 Создать песню" },
          ],
          [{ text: "🚀 Премиум" }, { text: "📋 Меню команд" }],
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

    await createUserConsent(user.id, "image_generation");
    await ctx.deleteMessage();

    const currentModel = user.selectedModel?.startsWith("model_image_")
      ? user.selectedModel
      : "model_image_gpt";

    await ctx.reply("Выберите модель для создания изображений:", {
      reply_markup: getImageModelKeyboard(currentModel),
    });
    await ctx.answerCallbackQuery("Условия приняты!");
    return;
  }

  // Handle premium/purchase buttons (placeholders)
  if (
    data === "/premium" ||
    data === "/pro" ||
    data.startsWith("buy_") ||
    data.startsWith("music_mode_")
  ) {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Эта функция в разработке. Свяжитесь с @support для подробностей."
    );
    return;
  }

  await ctx.answerCallbackQuery();
});

// --- Message Handlers ---

bot.on("message:text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  // Handle "📝 Выбрать модель" button
  if (text === "📝 Выбрать модель") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      /* Intentionally empty */
    }

    const [user] = await getUserByTelegramId(telegramId);
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
    return;
  }

  // Handle "🎨 Создать картинку" button
  if (text === "🎨 Создать картинку") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      /* Intentionally empty */
    }

    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      return;
    }

    // Check consent
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

    // Show menu directly if already consented
    const currentModel = user.selectedModel?.startsWith("model_image_")
      ? user.selectedModel
      : "model_image_gpt";

    await ctx.reply("Выберите модель для создания изображений:", {
      reply_markup: getImageModelKeyboard(currentModel),
    });
    return;
  }

  // Handle "🔎 Интернет-поиск" button
  if (text === "🔎 Интернет-поиск") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      /* Intentionally empty */
    }

    const [user] = await getUserByTelegramId(telegramId);
    const currentModel = user?.selectedModel || "model_gemini3pro";

    const searchText = `Выберите модель поиска:

ℹ️ Режим Deep Research готовит детально проработанные ответы

Отправьте ваш запрос в чат 👇`;

    await ctx.reply(searchText, {
      reply_markup: getSearchModelKeyboard(currentModel),
    });
    return;
  }

  // Handle "🎬 Создать видео" button
  if (text === "🎬 Создать видео") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      /* Intentionally empty */
    }

    const [user] = await getUserByTelegramId(telegramId);
    const currentModel = user?.selectedModel?.startsWith("model_video_")
      ? user.selectedModel
      : "model_video_veo";

    const videoMenuText = `Выберите сервис для создания ролика:

🎬 Veo 3.1, Sora 2, Kling, Pika и Hailuo создают видео по описанию или изображению`;

    await ctx.reply(videoMenuText, {
      reply_markup: getVideoModelKeyboard(currentModel),
    });
    return;
  }

  // Handle "🎸 Создать песню" button
  if (text === "🎸 Создать песню") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      /* Intentionally empty */
    }

    const musicMenuText = `Выберите режим генерации песни:

🥁 Простой режим — опишите о чем песня
🎸 Расширенный — свой текст и жанр`;

    await ctx.reply(musicMenuText, {
      reply_markup: getMusicGenerationKeyboard(),
    });
    return;
  }

  // Handle "🚀 Премиум" button
  if (text === "🚀 Премиум" || text === "/premium") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      /* Intentionally empty */
    }

    const premiumMenuText = `Доступ к лучшим ИИ-сервисам:

<b>БЕСПЛАТНО | ЕЖЕНЕДЕЛЬНО</b>
50 запросов: GPT-5 mini, Gemini 3 Flash, DeepSeek

<b>PREMIUM | ЕЖЕМЕСЯЧНО</b>
100 запросов в день
GPT-5.2, Claude 4.5, Gemini 3 Pro
Цена: 750 ₽

Есть вопросы? @support`;

    await ctx.reply(premiumMenuText, {
      parse_mode: "HTML",
      reply_markup: getPremiumKeyboard(),
    });
    return;
  }

  // Handle "📋 Меню команд" button
  if (text === "📋 Меню команд" || text === "/help") {
    try {
      await ctx.deleteMessage();
    } catch (_e) {
      /* Intentionally empty */
    }

    const commandsText = `<b>📋 Список команд бота:</b>

/start - О боте
/account - Мой аккаунт
/premium - Перейти в Премиум
/clear - Очистить чат
/photo - Создать изображение
/video - Создать видео
/suno - Создать песню
/s - Поиск в интернете
/model - Выбрать AI модель
/settings - Настройки
/help - Список команд
/privacy - Условия использования`;

    await ctx.reply(commandsText, {
      parse_mode: "HTML",
    });
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

export const POST = webhookCallback(bot, "std/http");
