import { generateText, tool } from "ai";
import { z } from "zod";
import { Bot, webhookCallback } from "grammy";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  createTelegramUser,
  getChatsByUserId,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserByTelegramId,
  incrementUserRequestCount,
  saveChat,
  saveMessages,
  setLastMessageId,
  updateUserSelectedModel,
} from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

export const maxDuration = 60;

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

const bot = new Bot(token);

// --- Constants & Helpers ---

const FREE_MODELS = ["model_gpt5mini", "model_gpt4omini", "model_gemini3flash"];

import { hasUserConsented, createUserConsent, updateUserPreferences } from "@/lib/db/queries";

// Helper for GPT Images Keyboard
function getGPTImagesKeyboard(aspectRatio: string = "1:1") {
    const isRatio = (r: string) => aspectRatio === r ? "✅ " : "";
    
    return {
        inline_keyboard: [
            [
                { text: `${isRatio("1:1")} 1:1`, callback_data: "set_ratio_1:1" },
                { text: `${isRatio("2:3")} 2:3`, callback_data: "set_ratio_2:3" },
                { text: `${isRatio("3:2")} 3:2`, callback_data: "set_ratio_3:2" }
            ],
            [
                { text: "📌 Инструкция", url: "https://example.com/instruction" } // Placeholder link
            ],
            [
                { text: "⬅️ Назад", callback_data: "menu_image_models" }
            ]
        ]
    };
}


function getImageModelKeyboard(selectedModel: string) {
    const isSelected = (id: string) => selectedModel === id ? "✅ " : "";
    
     return {
        inline_keyboard: [
            [
                { text: `${isSelected("model_image_gpt")}🌌 GPT Images`, callback_data: "model_image_gpt" },
                { text: `${isSelected("model_image_banana")}🍌 Nano Banana`, callback_data: "model_image_banana" }
            ],
            [
                { text: `${isSelected("model_image_midjourney")}🌅 Midjourney`, callback_data: "model_image_midjourney" },
                { text: `${isSelected("model_image_flux")}🔺 FLUX 2`, callback_data: "model_image_flux" }
            ],
            [
                 { text: `${isSelected("model_image_faceswap")}🎭 Замена лиц`, callback_data: "model_image_faceswap" },
                 { text: `${isSelected("model_image_avatars")}📸 Набор аватарок`, callback_data: "model_image_avatars" },
            ],
            [
                 { text: `${isSelected("model_image_upscale")}🔍 Увеличение X2/X4`, callback_data: "model_image_upscale" },
                 { text: "Закрыть", callback_data: "menu_close" }
            ]
        ]
    };
}


// ... inside callback handler ...

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const telegramId = ctx.from.id.toString();

    // ... (menu_start, menu_close, confirm_terms_image logic) ...
    
    // GPT Images Menu Logic
    if (data === "model_image_gpt") {
        const [user] = await getUserByTelegramId(telegramId);
        if (!user) { return; }

        // 1. Update selection
        await updateUserSelectedModel(user.id, "model_image_gpt");

        // 2. Get preferences
        const prefs = (user.preferences as any) || {};
        const currentRatio = prefs.aspect_ratio || "1:1";

        // 3. Send Promo Message (Photo + Text)
        // Since we can't easily upload a local file here without hosting, we'll try to just send text or use a placeholder URL.
        // Or if the user previously sent a photo, we could use that ID. 
        // For now, I'll use a generic placeholder or NO photo if I can't serve it.
        // User requested: "appears text with picture".
        // I will attempt to use a public placeholder or just send text for now, noting to user.
        
        await ctx.deleteMessage(); // Remove previous menu
        
        const text = `Создавайте и редактируйте изображения прямо в чате.

Готовы начать?
Отправьте изображение, которое вы хотите изменить, или напишите в чат, что нужно создать`;
        
        // Using a standard placeholder image to fulfill "picture" requirement visually
        // In prod, replace with actual file_id or hosted URL
        const placeholderUrl = "https://placehold.co/600x400/png"; 

        await ctx.replyWithPhoto(placeholderUrl, {
            caption: text,
            reply_markup: getGPTImagesKeyboard(currentRatio)
        });
        await ctx.answerCallbackQuery();
        return;
    }

    // Aspect Ratio Setters
    if (data.startsWith("set_ratio_")) {
        const ratio = data.replace("set_ratio_", "");
        const [user] = await getUserByTelegramId(telegramId);
        if (!user) { return; }

        await updateUserPreferences(user.id, { aspect_ratio: ratio });
        
        // Update keyboard
        try {
            await ctx.editMessageReplyMarkup({
                reply_markup: getGPTImagesKeyboard(ratio)
            });
            await ctx.answerCallbackQuery(`Формат ${ratio} выбран`);
        } catch (e) {
             await ctx.answerCallbackQuery();
        }
        return;
    }

    // ... (rest of handlers)




const MODEL_NAMES: Record<string, string> = {
    "model_gpt52": "GPT-5.2",
    "model_o3": "OpenAI o3",
    "model_gpt41": "GPT-4.1",
    "model_gpt5mini": "GPT-5 mini",
    "model_gpt4omini": "GPT-4o mini",
    "model_claude45sonnet": "Claude 4.5 Sonnet",
    "model_claude45thinking": "Claude 4.5 Thinking",
    "model_deepseek32": "DeepSeek-V3.2",
    "model_deepseek32thinking": "DeepSeek-V3.2 Thinking",
    "model_gemini3pro": "Gemini 3 Pro",
    "model_gemini3flash": "Gemini 3 Flash",
    "model_perplexity": "Perplexity",
    "model_grok41": "Grok 4.1",
    "model_deepresearch": "Deep Research",
    "model_video_veo": "Veo 3.1",
    "model_video_sora": "Sora Video",
    "model_video_kling": "Kling AI",
    "model_video_kling_effects": "Kling Effects",
    "model_video_pika": "Pika 2.5",
    "model_video_pika_effects": "Pika Effects",
    "model_video_hailuo": "Hailuo 2.3",
    "model_video_pikaddition": "Pikaddition"
};


function getVideoModelKeyboard(selectedModel: string) {
    const isSelected = (id: string) => selectedModel === id ? "✅ " : "";
    
    return {
        inline_keyboard: [
            [
                { text: `${isSelected("model_video_veo")}🪼 Veo 3.1`, callback_data: "model_video_veo" },
                { text: `${isSelected("model_video_sora")}☁️ Sora 2`, callback_data: "model_video_sora" }
            ],
            [
                { text: `${isSelected("model_video_kling")}🐼 Kling`, callback_data: "model_video_kling" },
                { text: `${isSelected("model_video_kling_effects")}✨ Kling Effects 🆕`, callback_data: "model_video_kling_effects" }
            ],
            [
                { text: `${isSelected("model_video_pika")}🐰 Pika`, callback_data: "model_video_pika" },
                { text: `${isSelected("model_video_pika_effects")}💫 Pika Effects`, callback_data: "model_video_pika_effects" }
            ],
            [
                { text: `${isSelected("model_video_hailuo")}🦊 Hailuo`, callback_data: "model_video_hailuo" },
                { text: `${isSelected("model_video_pikaddition")}🧩 Pikaddition`, callback_data: "model_video_pikaddition" }
            ],
            [
                { text: "Закрыть", callback_data: "menu_close" }
            ]
        ]
    };
}

function getMusicGenerationKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "🥁 Простой", callback_data: "music_mode_simple" },
                { text: "🎸 Расширенный", callback_data: "music_mode_advanced" }
            ],
            [
                { text: "Закрыть", callback_data: "menu_close" }
            ]
        ]
    };
}

function getPremiumKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "Premium", callback_data: "buy_premium" },
                { text: "Premium X2", callback_data: "buy_premium_x2" }
            ],
            [
                { text: "Midjourney", callback_data: "buy_midjourney" },
                { text: "Видео", callback_data: "buy_video" },
                { text: "Suno", callback_data: "buy_suno" }
            ],
             [
                { text: "Закрыть", callback_data: "menu_close" }
            ]
        ]
    };
}

function getSearchModelKeyboard(selectedModel: string) {
    const isSelected = (id: string) => selectedModel === id ? "✅ " : "";
    
     return {
        inline_keyboard: [
            [
                { text: `${isSelected("model_perplexity")}Perplexity`, callback_data: "model_perplexity" },
                { text: `${isSelected("model_gpt52")}GPT 5.2`, callback_data: "model_gpt52" },
                { text: `${isSelected("model_claude45sonnet")}Claude 4.5`, callback_data: "model_claude45sonnet" }
            ],
            [
                { text: `${isSelected("model_gemini3pro")}Gemini 3.0 Pro`, callback_data: "model_gemini3pro" },
                { text: `${isSelected("model_gemini3flash")}Gemini 3.0 Flash`, callback_data: "model_gemini3flash" }
            ],
            [
                 { text: `${isSelected("model_grok41")}Grok 4.1`, callback_data: "model_grok41" },
                 { text: `${isSelected("model_deepresearch")}Deep Research`, callback_data: "model_deepresearch" },
                 { text: "Закрыть", callback_data: "menu_close" }
            ]
        ]
    };
}

function getModelKeyboard(selectedModel: string) {
    const isSelected = (id: string) => selectedModel === id ? "✅ " : "";
    
    return {
        inline_keyboard: [
            [
                { text: `${isSelected("model_gpt52")}GPT-5.2`, callback_data: "model_gpt52" },
                { text: `${isSelected("model_o3")}OpenAI o3`, callback_data: "model_o3" },
                { text: `${isSelected("model_gpt41")}GPT-4.1`, callback_data: "model_gpt41" }
            ],
            [
                { text: `${isSelected("model_gpt5mini")}GPT-5 mini`, callback_data: "model_gpt5mini" },
                { text: `${isSelected("model_gpt4omini")}GPT-4o mini`, callback_data: "model_gpt4omini" }
            ],
            [
                { text: `${isSelected("model_claude45sonnet")}Claude 4.5 Sonnet`, callback_data: "model_claude45sonnet" },
                { text: `${isSelected("model_claude45thinking")}Claude 4.5 Thinking`, callback_data: "model_claude45thinking" }
            ],
            [
                { text: `${isSelected("model_deepseek32")}DeepSeek-V3.2`, callback_data: "model_deepseek32" },
                { text: `${isSelected("model_deepseek32thinking")}DeepSeek-V3.2 Thinking`, callback_data: "model_deepseek32thinking" }
            ],
            [
                { text: `${isSelected("model_gemini3pro")}Gemini 3 Pro`, callback_data: "model_gemini3pro" },
                { text: `${isSelected("model_gemini3flash")}Gemini 3 Flash`, callback_data: "model_gemini3flash" }
            ],
            [
                { text: "⬅️ Назад", callback_data: "menu_start" }
            ]
        ]
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
          [{ text: "🎡 Колесо фортуны", web_app: { url: "https://t.me/aporto_bot/app" } }, { text: "📝 Выбрать модель" }],
          [{ text: "🎨 Создать картинку" }, { text: "🔎 Интернет-поиск" }],
          [{ text: "🎬 Создать видео" }, { text: "🎸 Создать песню" }],
          [{ text: "🚀 Премиум" }, { text: "👤 Мой профиль" }],
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

// --- Callback Config ---

bot.on("callback_query:data", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const data = ctx.callbackQuery.data;

    // Handle "Back" button
    if (data === "menu_start") {
        await ctx.deleteMessage();
        return;
    }

    if (data === "menu_close") {
        await ctx.deleteMessage();
        return;
    }

    if (data === "menu_image_models") {
        // Go back to Image Models List
        const [user] = await getUserByTelegramId(telegramId);
        if (!user) { return; }
        
         const imageMenuText = `🌠 GPT Image 1.5 от OpenAI – генерация и редактирование изображений.

🍌 Gemini 3 Pro Images (Nano Banana Pro) – ИИ-фотошоп от Google.

🌅 Midjourney, FLUX 2 – создание изображений по вашему описанию.
...
`; // Shortened for diff
         const currentModel = user.selectedModel?.startsWith("model_image_") ? user.selectedModel : "model_image_gpt"; 

         await ctx.editMessageText(`🌠 GPT Image 1.5 от OpenAI – генерация и редактирование изображений.

🍌 Gemini 3 Pro Images (Nano Banana Pro) – ИИ-фотошоп от Google.

🌅 Midjourney, FLUX 2 – создание изображений по вашему описанию.

📸 Набор аватарок – 100 классных аватарок в разных стилях по одному фото.

🎭 Замена лица, повышение качества и другие сервисы 👇`, {
             reply_markup: getImageModelKeyboard(currentModel)
         });
         return;
    }




    // Handle "Terms Agreement"
     if (data === "confirm_terms_image") {
        const [user] = await getUserByTelegramId(telegramId);
        if (!user) { return; } 

        await createUserConsent(user.id, "image_generation");
        
        // Show the menu immediately
        await ctx.deleteMessage(); // Delete terms message
        
         const imageMenuText = `🌠 GPT Image 1.5 от OpenAI – генерация и редактирование изображений.

🍌 Gemini 3 Pro Images (Nano Banana Pro) – ИИ-фотошоп от Google.

🌅 Midjourney, FLUX 2 – создание изображений по вашему описанию.

📸 Набор аватарок – 100 классных аватарок в разных стилях по одному фото.

🎭 Замена лица, повышение качества и другие сервисы 👇`;

         // Default to GPT Image or existing selection if it's an image model
         const currentModel = user.selectedModel?.startsWith("model_image_") ? user.selectedModel : "model_image_gpt"; 

         await ctx.reply(imageMenuText, {
             reply_markup: getImageModelKeyboard(currentModel)
         });
         await ctx.answerCallbackQuery("Условия приняты!");
         return;
    }
    // Handle Video Model Selection
    if (data.startsWith("model_video_")) {
         const [user] = await getUserByTelegramId(telegramId);
         if (!user) { return; }
         
         // Permission Check (All video models likely Premium?)
         // Assuming all video models are premium for now
         if (!user.hasPaid && !FREE_MODELS.includes(data)) {
              await ctx.answerCallbackQuery({
                  text: "💎 Модель доступна в Premium",
                  show_alert: true
              });
              return;
         }

         // Update selection
         await updateUserSelectedModel(user.id, data);
         
         // Refresh UI
          try {
            await ctx.editMessageReplyMarkup({
                reply_markup: getVideoModelKeyboard(data)
            });
            await ctx.answerCallbackQuery("Видео модель выбрана!");
        } catch (e) {
            await ctx.answerCallbackQuery(); 
        }
        return;
    }

    // Handle Image Model Selection
    if (data.startsWith("model_image_")) {
         const [user] = await getUserByTelegramId(telegramId);
         if (!user) { return; }
         
         // Update selection (reusing shared field)
         await updateUserSelectedModel(user.id, data);
         
         // Refresh UI
          try {
            await ctx.editMessageReplyMarkup({
                reply_markup: getImageModelKeyboard(data)
            });
            await ctx.answerCallbackQuery("Модель выбрана!");
        } catch (e) {
            await ctx.answerCallbackQuery(); 
        }
        return;
    }

    // Handle Search Model Selection
    const SEARCH_MODELS = ["model_perplexity", "model_grok41", "model_deepresearch", "model_gpt52", "model_claude45sonnet", "model_gemini3pro", "model_gemini3flash"];
    // Some models (gpt52, claude, gemini) overlap with main menu. We need to know context to refresh correct keyboard.
    // However, the callback doesn't carry context "source menu". 
    // Heuristic: If we are here, we might just try to edit with *both* keyboards? No, that throws error if content redundant.
    // Better: Check if message text matches Search Menu text.
    
    // Simplification: We will support updating the SEARCH keyboard if the data matches specific search-only models OR if we detect the message content.
    // Actually, `editMessageReplyMarkup` only updates the markup. If we use a specialized function that tries to guess which keyboard to return, it might work?
    // OR, we just check if the model is one of the search-exclusive ones?
    // No, because user can select GPT-5.2 in search menu too.
    
    // Let's check `ctx.callbackQuery.message.text`.
    const msgText = ctx.callbackQuery.message?.text || "";
    const isSearchMenu = msgText.includes("Режим Deep Research");
    
    if (isSearchMenu && (SEARCH_MODELS.includes(data) || data.startsWith("model_"))) {
        const [user] = await getUserByTelegramId(telegramId);
        if(!user) { return; }

         // Permission Check (for Premium models in search)
         // Assuming Perplexity/DeepResearch/Grok are PRO only.
         const isFreeSearch = ["model_gemini3flash"].includes(data); // Example free
         if (!user.hasPaid && !isFreeSearch && !FREE_MODELS.includes(data)) {
             // ... Premium check logic same as main menu
              await ctx.answerCallbackQuery({
                  text: "💎 Модель доступна в Premium",
                  show_alert: true
              });
              return;
         }

         await updateUserSelectedModel(user.id, data);
         
         try {
            await ctx.editMessageReplyMarkup({
                reply_markup: getSearchModelKeyboard(data)
            });
            await ctx.answerCallbackQuery("Модель поиска выбрана!");
         } catch(e) {
             await ctx.answerCallbackQuery();
         }
         return;
    }



    // Handle model selection for standard text models (fallback if not caught by Search logic above)
    // IMPORTANT: If we are in the Search Menu, we already handled it. 
    // This block handles MAIN MENU model selection.
    if (data.startsWith("model_")) {
        // If we reached here, it means it wasn't caught by Search Menu logic (or message text didn't match).
        // Standard Model Selection Logic
        const [user] = await getUserByTelegramId(telegramId);
        if (!user) { return; } 

        const isFreeModel = FREE_MODELS.includes(data);

        // Check Entitlement
        if (!user.hasPaid && !isFreeModel) {
             const modelName = MODEL_NAMES[data] || "Selected Model";
             await ctx.reply(`⚠️ Для отправки запросов к модели ${modelName} приобретите подписку Премиум`, {
                 reply_markup: {
                     inline_keyboard: [
                         [{ text: "🚀 Подключить премиум", callback_data: "/premium" }] 
                     ]
                 }
             });
             await ctx.answerCallbackQuery();
             return;
        }

        // Update Selection
        await updateUserSelectedModel(user.id, data);

        // Update UI (Refresh Keyboard)
        try {
            // We assume this is Main Menu because Search Menu was handled above.
            await ctx.editMessageReplyMarkup({
                reply_markup: getModelKeyboard(data)
            });
            await ctx.answerCallbackQuery("Модель выбрана!");
        } catch (e) {
            await ctx.answerCallbackQuery(); 
        }
        return;
    }

    
    // Handle /premium or /pro placeholder callbacks
    if (data === "/premium" || data === "/pro") {
        await ctx.answerCallbackQuery();
        await ctx.reply("Для подключения Premium перейдите в раздел /premium (функционал в разработке).");
        return;
    }

    await ctx.answerCallbackQuery();
});

// --- Helper: Get File URL ---
async function getTelegramFileUrl(fileId: string): Promise<string | null> {
    try {
        const file = await bot.api.getFile(fileId);
        if (file.file_path) {
            return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        }
    } catch (e) {
        console.error("Error fetching file URL:", e);
    }
    return null;
}

// --- Shared Message Processor ---

async function processTelegramMessage(
    ctx: any, 
    user: any, 
    text: string, 
    attachments: Array<{ type: "image" | "file"; url: string; fileId: string; mimeType?: string }>
) {
  const telegramId = user.telegramId;

  // 1.1 Idempotency Check
  const isNew = await setLastMessageId(
    user.id,
    ctx.message.message_id.toString()
  );
  if (!isNew) {
    return; // Silent return
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
  
  // Construct parts for DB and AI
  const messageParts: any[] = [];
  if (text) { messageParts.push({ type: "text", text }); }
  
  // Add attachments to parts
  for (const att of attachments) {
      if (att.type === 'image') {
          messageParts.push({ type: "image", image: att.url });
      }
      // Future: handle files
  }

  const userMessageId = generateUUID();
  await saveMessages({
    messages: [
      {
        id: userMessageId,
        chatId,
        role: "user",
        parts: messageParts, // Now contains text AND images
        attachments: attachments, // Metadata for future reference (e.g. file_id)
        createdAt: new Date(),
      },
    ],
  });

  // Increment request count
  await incrementUserRequestCount(user.id);

  // 4. Fetch History
  const history = await getMessagesByChatId({ id: chatId });
  
  // Convert DB history to Vercel AI SDK CoreMessage format
  const aiMessages: any[] = history.map((m) => {
      // m.parts is stored as JSON, we cast it
      const parts = m.parts as any[];
      
      // Map parts to valid AI SDK CoreMessage parts
      const content = parts.map(p => {
          if (p.type === 'text') { return { type: 'text', text: p.text }; }
          if (p.type === 'image') { return { type: 'image', image: p.image }; } // URL
          return null;
      }).filter(Boolean);

      return {
          role: m.role,
          content: content
      };
  });

  // 5. Generate Response
  // Use GPT-4.1 Nano or SELECTED model if available?
  // User requested model selection effect. 
  // CURRENT LOGIC: uses hardcoded nano model. 
  // TODO: Switch to user.selectedModel if mapping exists and is valid.
  
  // If image is present, we might want a multimodal model. 
  // GPT-4o-mini (mapped to "model_gpt4omini") is multimodal.
  // "openai/gpt-4.1-nano-2025-04-14" -> Assuming this is fictional, mapping to gpt-4o-mini for real usage or keeping as is?
  // Let's rely on user selection.
  
  let modelId = user.selectedModel ? (Object.keys(MODEL_NAMES).find(key => key === user.selectedModel) || "model_gpt4omini") : "model_gpt4omini";

  // Map our internal IDs to real Vercel AI SDK Provider IDs
  const PROVIDER_MAP: Record<string, string> = {
      "model_gpt52": "openai/gpt-4-turbo", // Placeholder for 5.2
      "model_o3": "openai/gpt-4o", // Placeholder for o3
      "model_gpt41": "openai/gpt-4-turbo", // Placeholder for 4.1
      "model_gpt5mini": "openai/gpt-4o-mini", // Placeholder
      "model_gpt4omini": "openai/gpt-4o-mini",
      "model_claude45sonnet": "anthropic/claude-3-5-sonnet-20240620",
      "model_claude45thinking": "anthropic/claude-3-5-sonnet-20240620",
      "model_deepseek32": "openai/gpt-4o", // Placeholder if provider not configured
      "model_deepseek32thinking": "openai/gpt-4o",
      "model_gemini3pro": "google/gemini-1.5-pro-latest",
      "model_gemini3flash": "google/gemini-1.5-flash-latest"
  };

  // Fallback to gpt-4o-mini (multimodal) if selection invalid
  let realModelId = PROVIDER_MAP[modelId] || "openai/gpt-4o-mini";
  
  // If sending images, ensure we use a multimodal model. 
  // All listed above are multimodal except deeply strict text models (but most today are visual).
  
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
        description: "Generate an image, picture, or drawing. Use this tool when the user asks to 'draw', 'create', 'generate' or 'make' an image/picture (keywords: нарисуй, создай, сгенерируй, сделай картинку/изображение).",
        inputSchema: z.object({
           prompt: z.string().describe("The description of the image to generate"),
        }),
      }),
    },
  });

  // Handle Tool Calls (specifically Image Generation)
  if (response.toolCalls && response.toolCalls.length > 0) {
      const imageToolCall = response.toolCalls.find(tc => tc.toolName === 'generateImage');
      
      if (imageToolCall) {
          if (userType !== 'pro') {
               // Refusal with Inline Buttons
               await ctx.reply("Для генерации изображений необходима PRO-подписка. 🔒\nВы можете купить её или попробовать выиграть в Колесе Фортуны!", {
                   reply_markup: {
                       inline_keyboard: [
                           [
                               { text: "Купить PRO", callback_data: "/pro" }
                           ],
                           [
                               { text: "Колесо Фортуны", web_app: { url: "https://t.me/aporto_bot/app" } }
                           ]
                       ]
                   }
               });
               return;
          } else {
               // Success (Stub)
               await ctx.reply("Генерация изображений скоро будет доступна! 🎨");
               return;
          }
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
}

// --- Message Handlers ---

bot.on("message:text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  // Handle "🎨 Создать картинку" button click
  if (text === "🎨 Создать картинку") {
    try { await ctx.deleteMessage(); } catch { /* ignore */ }

    const [user] = await getUserByTelegramId(telegramId);
    if (!user) {
        // Should exist, but standard RAG checks
        return;
    }
    
    // Check consent
    const hasConsented = await hasUserConsented(user.id, "image_generation");
    
    if (!hasConsented) {
        const termsText = `Вы переходите в раздел редактирования изображений. Ознакомьтесь с правилами использования.

Запрещается:
• загружать обнаженные фото
• использовать созданные изображения для провокации, обмана, шантажа и любых действий, нарушающих закон

Напоминание:
Ответственность за генерацию лежит целиком на пользователе. Продолжая, вы соглашаетесь с условиями использования сервиса и обязуетесь соблюдать законы своей страны.`;

        await ctx.reply(termsText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Соглашаюсь с условиями", callback_data: "confirm_terms_image" }]
                ]
            }
        });
        return;
    }

    // Show Menu directly if already consented
    const imageMenuText = `🌠 GPT Image 1.5 от OpenAI – генерация и редактирование изображений.

🍌 Gemini 3 Pro Images (Nano Banana Pro) – ИИ-фотошоп от Google.

🌅 Midjourney, FLUX 2 – создание изображений по вашему описанию.

📸 Набор аватарок – 100 классных аватарок в разных стилях по одному фото.

🎭 Замена лица, повышение качества и другие сервисы 👇`;

     const currentModel = user?.selectedModel?.startsWith("model_image_") ? user.selectedModel : "model_image_gpt"; 

     await ctx.reply(imageMenuText, {
         reply_markup: getImageModelKeyboard(currentModel)
     });
    return;
  }

  // Handle "🔎 Интернет-поиск" button click
  if (text === "🔎 Интернет-поиск") {
      try { await ctx.deleteMessage(); } catch { /* ignore */ }
      
      const [user] = await getUserByTelegramId(telegramId);
      const currentModel = user?.selectedModel || "model_gemini3pro"; // Default to a search-capable model?

      const searchText = `Выберите модель поиска или оставьте выбранную модель по-умолчанию

ℹ️ Режим Deep Research готовит детально проработанные ответы, поэтому занимает больше времени

Чтобы начать поиск отправьте в чат ваш запрос 👇`;

      await ctx.reply(searchText, {
          reply_markup: getSearchModelKeyboard(currentModel)
      });
      return;
  }

  // Handle "🎬 Создать видео" button click
  if (text === "🎬 Создать видео") {
      try { await ctx.deleteMessage(); } catch { /* ignore */ }

      const [user] = await getUserByTelegramId(telegramId);
      // Default to first video model if none selected, or keep existing if it is a video model.
      const currentModel = user?.selectedModel?.startsWith("model_video_") ? user.selectedModel : "model_video_veo";

      const videoMenuText = `Выберите сервис для создания ролика:

🎬 Veo 3.1, Sora 2, Kling, Pika и Hailuo 2.3 создают короткие видео в HD по вашему описанию, на основе изображения или по первому и последнему кадрам.

💫 Kling Effects и Pika Effects «оживляют» ваши изображения и добавляют к ним визуальные эффекты.

🧩 Pikaddition добавляет в ваше видео любой объект или персонажа с фото.`;

      await ctx.reply(videoMenuText, {
          reply_markup: getVideoModelKeyboard(currentModel)
      });
      return;
  }

  // Handle "🎸 Создать песню" button click
  if (text === "🎸 Создать песню") {
      try { await ctx.deleteMessage(); } catch { /* ignore */ }

      const musicMenuText = `Выберите режим генерации песни:
🥁 В простом режиме достаточно описать, о чем будет песня и в каком жанре
🎸 В расширенном можно выбрать необычный жанр, а также создать песню со своим текстом`;

      await ctx.reply(musicMenuText, {
          reply_markup: getMusicGenerationKeyboard()
      });
      return;
  }

  // Handle "🚀 Премиум" button click
  if (text === "🚀 Премиум" || text === "/premium") {
      try { await ctx.deleteMessage(); } catch { /* ignore */ }

      const premiumMenuText = `Бот предоставляет доступ к лучшим ИИ-сервисам на одной платформе:

<b>БЕСПЛАТНО | ЕЖЕНЕДЕЛЬНО</b>
50 запросов в неделю
✅ GPT-5 mini | GPT-4o mini
✅ DeepSeek-V3.2 | Gemini 3 Flash
✅ Perplexity поиск в интернете
✅ Распознавание изображений
10 генераций изображений
🌅 Nano Banana | GPT Image 1.5

<b>PREMIUM | ЕЖЕМЕСЯЧНО</b>
🔼 Лимит запросов – 100 в день
✅ Все модели выше
🌅 Nano Banana Pro | GPT Image 1.5
✅ GPT-5.2 | GPT-4.1 | OpenAI o3
✅ Gemini 3 Pro | Claude 4.5
✅ Голосовые ответы
✅ Анализ файлов
✅ Без рекламы
Цена: 750 ₽

<b>PREMIUM X2 | ЕЖЕМЕСЯЧНО</b>
⏫ Лимит запросов – 200 в день
✅ Все преимущества “Premium”
Цена: 1100 ₽

<b>MIDJOURNEY & FLUX | ПАКЕТ</b>
От 50 до 500 генераций
🌅 Midjourney V7 & Flux 2
✅ Midjourney Video
✅ Замена лиц
Цена: От 350 ₽

<b>VIDEO | ПАКЕТ</b>
От 2 до 50 генераций
🎬 Veo 3.1 | Sora 2 | Kling | Hailuo | Pika
✅ Текст-в-видео, фото-в-видео
✅ Креативные визуальные эффекты
Цена: От 225 ₽

<b>SUNO SONGS | ПАКЕТ</b>
От 50 до 100 генераций
🎸 Suno V5 AI модель
✅ Свой или сгенерированный текст
Цена: От 350 ₽

💬 Есть вопросы? Пишите @GoPevzner`;

      await ctx.reply(premiumMenuText, {
          parse_mode: "HTML",
          reply_markup: getPremiumKeyboard()
      });
      return;
  }

  // Handle "Выбрать модель" button click
  if (text === "📝 Выбрать модель") {
    // ... (Use existing logic or move to separate function)
    const [user] = await getUserByTelegramId(telegramId);
    const currentModel = user?.selectedModel || "model_gpt4omini";
    // ... Copy paste existing model info logic ...
    
    // For brevity, I'll keep the response logic inline here or ensure it's preserved if I'm replacing the whole block.
    // Re-implementing compact version:
    
    const modelInfo = `В боте доступны ведущие модели ChatGPT, Claude, Gemini и DeepSeek:
(см. описание выше)
GPT-5 mini, Gemini 3 Flash и DeepSeek доступны бесплатно. Доступ к другим моделям можно приобрести в /premium`;

    // To save tokens/complexity, assuming the previous text is fine.
    // But since I'm replacing the block, I need to put the text back.
    
    const modelInfoFull = `В боте доступны ведущие модели ChatGPT, Claude, Gemini и DeepSeek:

⭐️ GPT-5.2 — новая топ-модель OpenAI.
🔥 GPT-4.1 — универсальная модель для кодинга и работы с текстами.
✔️ GPT-5 mini — быстрые модели для повседневных вопросов.
🍓 OpenAI o3 — рассуждающая модель. Находит лучшее решение сложных задач.

🚀 Claude 4.5 Sonnet — модель для работы с текстами, кодинга и математики.
💬️ Claude 4.5 Thinking — рассуждающий режим Sonnet 4.5 для более точного ответа. Каждый запрос расходует 2 генераций.

🐼 DeepSeek-V3.2 — текстовая модель от китайского разработчика.
🐳 DeepSeek-V3.2 Thinking — рассуждающая модель для сложных задач.

🤖 Gemini 3 Pro — топ-модель Google.
⚡️ Gemini 3 Flash — мощная и быстрая рассуждающая модель Google.

Работа с документами (docx, pdf, xlsx, xls, csv, pptx, txt) доступна в Премиум. Можно отправить боту файл размером до 10 MB и задавать по нему вопросы. Каждый запрос расходует 3 генерации.

GPT-5 mini, Gemini 3 Flash и DeepSeek доступны бесплатно. Доступ к другим моделям можно приобрести в /premium`;

    try { await ctx.deleteMessage(); } catch {}
    await ctx.reply(modelInfoFull, { reply_markup: getModelKeyboard(currentModel) });
    return;
  }

  // Common User Fetch
  try {
      let [user] = await getUserByTelegramId(telegramId);
      if (!user) [user] = await createTelegramUser(telegramId);
      
      await processTelegramMessage(ctx, user, text, []);
  } catch (error) {
      console.error("Telegram Webhook Error:", error);
      await ctx.reply("Sorry, something went wrong processing your message.");
  }
});

bot.on("message:photo", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const caption = ctx.message.caption || "";
    
    // Get highest res photo
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    
    try {
        let [user] = await getUserByTelegramId(telegramId);
        if (!user) [user] = await createTelegramUser(telegramId);
        
        // Resolve URL
        const fileUrl = await getTelegramFileUrl(fileId);
        if (!fileUrl) {
            await ctx.reply("Не удалось загрузить изображение. Попробуйте снова.");
            return;
        }
        
        await processTelegramMessage(ctx, user, caption, [{
            type: "image",
            url: fileUrl,
            fileId: fileId
        }]);
    } catch (error) {
         console.error("Telegram Webhook Error (Photo):", error);
         await ctx.reply("Sorry, something went wrong processing your image.");
    }
});

export const POST = webhookCallback(bot, "std/http");
