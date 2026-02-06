import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getPendingMessages,
  markMessageAsFailed,
  markMessageAsSent,
} from "@/lib/db/messaging-queries";
import { messageSend } from "@/lib/db/schema";
import { identifyBackendUser, trackBackendEvent } from "@/lib/mixpanel";

// Cron job to send pending messages
// Schedule: Every 1 minute via Vercel Cron or external scheduler

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");

export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization (bypass in development or if no secret set)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    console.log("[Cron] Starting message processing...", {
      env: process.env.NODE_ENV,
      hasSecret: !!cronSecret,
      authHeader,
    });

    if (
      process.env.NODE_ENV === "production" &&
      cronSecret &&
      authHeader !== `Bearer ${cronSecret}`
    ) {
      console.warn("[Cron] Unauthorized attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pendingMessages = await getPendingMessages(100);
    let sentCount = 0;
    let failedCount = 0;

    for (const msgRow of pendingMessages) {
      if (!msgRow.MessageSend || !msgRow.MessageTemplate || !msgRow.User) {
        continue;
      }

      const send = msgRow.MessageSend;
      const template = msgRow.MessageTemplate;
      const user = msgRow.User;

      try {
        // Prepare message options
        const options: any = {
          parse_mode: template.contentType === "html" ? "HTML" : undefined,
        };

        // Add inline keyboard if exists
        if (template.inlineKeyboard) {
          options.reply_markup = {
            inline_keyboard: template.inlineKeyboard,
          };
        }

        // Send message via Telegram
        let sentMessage;
        if (template.mediaType === "photo" && template.mediaUrl) {
          sentMessage = await bot.api.sendPhoto(
            user.telegramId!,
            template.mediaUrl,
            {
              caption: template.content,
              ...options,
            }
          );
        } else {
          sentMessage = await bot.api.sendMessage(
            user.telegramId!,
            template.content,
            options
          );
        }

        // Mark as sent
        await markMessageAsSent(
          send.id,
          sentMessage.message_id.toString(),
          sentMessage.chat.id.toString()
        );

        // Track in Mixpanel
        await trackMessageInMixpanel(send, template, user);

        sentCount++;
      } catch (error) {
        console.error(`Failed to send message ${send.id}:`, error);

        // Mark as failed
        await markMessageAsFailed(
          send.id,
          error instanceof Error ? error.message : "Unknown error",
          (send.retryCount || 0) + 1
        );

        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: pendingMessages.length,
    });
  } catch (error: any) {
    console.error("Message sending error:", error);
    return NextResponse.json(
      { error: error.message || "Sending failed" },
      { status: 500 }
    );
  }
}

async function trackMessageInMixpanel(send: any, template: any, user: any) {
  try {
    const eventName =
      send.sendType === "follow_up"
        ? "Message: Follow-up Sent"
        : "Message: Broadcast Sent";

    // Track event
    trackBackendEvent(eventName, user.id, {
      template_id: template.id,
      template_name: template.name,
      message_type: send.sendType,
      target_audience: template.targetAudience,
      has_subscription: user.hasPaid,
      template_type: template.templateType,
    });

    // Update user profile properties
    const incrementProp =
      send.sendType === "follow_up"
        ? "follow_up_messages_received"
        : "broadcast_messages_received";

    identifyBackendUser(user.id, {
      last_message_sent_at: new Date().toISOString(),
      [incrementProp]: 1, // Note: Mixpanel will handle increment
    });

    // Mark as tracked in DB
    await db
      .update(messageSend)
      .set({ mixpanelTracked: true })
      .where(eq(messageSend.id, send.id));
  } catch (error) {
    console.error("Failed to track in Mixpanel:", error);
  }
}
