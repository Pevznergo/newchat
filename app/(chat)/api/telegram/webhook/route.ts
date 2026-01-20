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
} from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

export const maxDuration = 60;

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

const bot = new Bot(token);

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

    await ctx.reply(welcomeMessage);
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

bot.on("message:text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  try {
    // 0. Drop Stale Updates (Force Clear Queue)
    // Telegram timestamps are in seconds. Date.now() is ms.
    const messageDate = ctx.message.date; // UNIX timestamp in seconds
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

    // 1.1 Idempotency Check (Race Condition Fix)
    // Attempt to set this message ID. If we fail, it means another worker beat us to it.
    const isNew = await setLastMessageId(
      user.id,
      ctx.message.message_id.toString()
    );
    if (!isNew) {
      console.warn(
        `Dropping duplicate/concurrent processing for message ${ctx.message.message_id}`
      );
      return; // Silent return, let the other worker invoke response
    }

    // --- ENFORCEMENT START ---
    const userType: "pro" | "regular" = user.hasPaid ? "pro" : "regular"; // Telegram users are minimally regular if created via bot, but logic handles guests separate in Auth.
    // Here we treat non-paid Telegram users as "regular" (15 msgs) to align with request, OR strictly follow Auth.ts logic?
    // User schema has email nullable. If created via Telegram code:
    // createTelegramUser makes new user.
    // Let's assume standard Telegram user = "regular" (15 messages), paid = "pro".
    // "Guest" concept in Auth.ts was for incognito web users. Telegram users are identifiable => Registered.

    // Check Limits
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
      // Telegram users are considered "Registered" (Regular) for now
      await ctx.reply(
        "Ой, дневной лимит сообщений исчерпан! 🛑\n\nНо это не конец! 🚀\nПереходите на **PRO-тариф** для безлимитного общения или испытайте удачу в **Колесе Фортуны** 🎡 — там можно выиграть дополнительные токены, подписку и другие призы.\n\nВозвращайтесь к общению без границ!"
      );
      return;
    }
    // --- ENFORCEMENT END ---

    // 2. Find active chat or create new one
    // We fetch the most recent chat for the user
    const { chats } = await getChatsByUserId({
      id: user.id,
      limit: 1,
      startingAfter: null,
      endingBefore: null,
    });

    let chatId: string;
    let _isNewChat = false;

    if (chats.length > 0) {
      chatId = chats[0].id;
    } else {
      chatId = generateUUID();
      _isNewChat = true;
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
          attachments: [], // Correct type usage?
          createdAt: new Date(),
        },
      ],
    });

    // Increment request count
    await incrementUserRequestCount(user.id);

    // 4. Fetch History
    const history = await getMessagesByChatId({ id: chatId });
    // Convert to CoreMessages for AI SDK
    // DBMessage parts are JSON, so we need to ensure correct format
    const _coreMessages = history.map((msg) => {
      // msg.parts is JSON, assume it's compatible or needs parsing
      // Based on schema, it's `json("parts")`. In DBMessage type, it matches core message parts.
      const content = (msg.parts as any[]).map((p) => {
        if (p.type === "text") {
          return { type: "text", text: p.text };
        }
        // Handle other types if needed, or filter
        return { type: "text", text: "" };
      });
      return {
        role: msg.role as "user" | "assistant" | "system",
        content: content.map((c) => c.text).join("\n"),
      }; // simplified for now, or use complex struct
    });

    // Better: use convertToUIMessages then convertToCoreMessages if available, or just map manually
    // Simplest for now: user/assistant alternating text.

    // Actually, `generateText` accepts `messages` as `CoreMessage[]`.
    const aiMessages: any[] = history.map((m) => ({
      role: m.role,
      content: (m.parts as any[]).map((p) => p.text).join("\n"),
    }));

    // 5. Generate Response with Timeout
    // 5. Generate Response
    // Use GPT-4.1 Nano for Telegram to ensure maximum speed, lowest latency.
    const modelId = "openai/gpt-4.1-nano-2025-04-14";

    await ctx.replyWithChatAction("typing");

    const response = await generateText({
      model: getLanguageModel(modelId),
      system: systemPrompt({
        selectedChatModel: modelId,
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
      // maxSteps: 1, // Stop after tool call so we can handle it manually
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
                                 { text: "Купить PRO", callback_data: "/pro" } // Assuming /pro handler exists or will catch this
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

    // Safety truncate to avoid endless loop if somehow huge
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
