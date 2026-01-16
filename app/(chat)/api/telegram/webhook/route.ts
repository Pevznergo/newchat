import { generateText } from "ai";
import { Bot, webhookCallback } from "grammy";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  createTelegramUser,
  getChatsByUserId,
  getMessagesByChatId,
  getUserByTelegramId,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

export const maxDuration = 60;

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return;
  }

  const firstName = ctx.from?.first_name || "";
  const username = ctx.from?.username || "";
  const displayName = firstName || username || "Friend";

  let [user] = await getUserByTelegramId(telegramId);
  if (!user) {
    [user] = await createTelegramUser(telegramId);
  }

  const welcomeMessage = `Привет, ${displayName}!

Я — Апорто! Готов стать твоим AI-напарником.

Забудь о рутине, я могу почти всё! 💪

🗣️ Болтать: Принимаю текст и голосовые.

🎨 Рисовать: Создам любую картинку по твоему описанию.

📄 Читать: Скидывай мне любой документ – я быстро вникну в суть.

🎬 Смотреть: Отправь видео или ссылку на него, а я сделаю всю грязную работу – перескажу, найду главное, проверю факты.

🔥 Для быстрых задач есть бесплатные модели, а для чего-то серьезного – целый арсенал платных AI-мозгов. Жми /select_model, чтобы выбрать!

P.S. Я могу обращаться к тебе так, как ты захочешь! Просто скажи мне. 💬

Давай творить! 🚀`;

  await ctx.reply(welcomeMessage);
});

bot.on("message:text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  try {
    // 1. Get or Create User
    let [user] = await getUserByTelegramId(telegramId);
    if (!user) {
      [user] = await createTelegramUser(telegramId);
    }

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

    // 5. Generate Response
    const modelId = DEFAULT_CHAT_MODEL;

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
    });

    // 6. Send Response
    await ctx.reply(response.text);

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
