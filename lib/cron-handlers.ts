import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import { db } from "@/lib/db";
import {
	checkAndUpdateCampaignStatus,
	getActiveFollowUpRules,
	getPendingMessages,
	getUsersForFollowUp,
	hasReceivedFollowUp,
	markMessageAsFailed,
	markMessageAsSent,
	scheduleMessage,
} from "@/lib/db/messaging-queries";
import {
	extendSubscription,
	getExpiringSubscriptions,
	getTariffBySlug,
} from "@/lib/db/queries";
import { messageSend } from "@/lib/db/schema";
import { identifyBackendUser, trackBackendEvent } from "@/lib/mixpanel";
import { createRecurringPayment } from "@/lib/payment";

// Initialize bot
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");

// Helper to track messages in Mixpanel
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
			[incrementProp]: 1, // Note: Mixpanel will handle increment if configured, or just set
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

/**
 * Process pending messages (Broadcasts & Follow-ups)
 */
export async function processPendingMessages() {
	console.log("[Scheduler] Processing pending messages...");

	try {
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
			const telegramId = user.telegramId;

			if (!telegramId) {
				console.warn(`[Scheduler] User ${user.id} has no telegramId`);
				failedCount++;
				continue;
			}

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
				let sentMessage: any;
				if (template.mediaUrl) {
					if (template.mediaType === "photo") {
						sentMessage = await bot.api.sendPhoto(
							telegramId,
							template.mediaUrl,
							{
								caption: template.content,
								...options,
							},
						);
					} else if (template.mediaType === "video") {
						console.log(
							`[Scheduler] Sending VIDEO to ${telegramId}. URL/ID: ${template.mediaUrl}`,
						);
						try {
							sentMessage = await bot.api.sendVideo(
								telegramId,
								template.mediaUrl,
								{
									caption: template.content,
									...options,
								},
							);
							console.log(
								`[Scheduler] Video sent successfully. Message ID: ${sentMessage.message_id}`,
							);
						} catch (videoError: any) {
							console.error(
								`[Scheduler] Video send failed for user ${telegramId}:`,
								videoError.message,
							);
							throw videoError; // Re-throw to be caught by outer catch
						}
					} else if (template.mediaType === "document") {
						sentMessage = await bot.api.sendDocument(
							telegramId,
							template.mediaUrl,
							{
								caption: template.content,
								...options,
							},
						);
					} else {
						// Fallback to text if media type unknown but URL exists
						sentMessage = await bot.api.sendMessage(
							telegramId,
							template.content,
							options,
						);
					}
				} else {
					sentMessage = await bot.api.sendMessage(
						telegramId,
						template.content,
						options,
					);
				}

				// Mark as sent
				await markMessageAsSent(
					send.id,
					sentMessage.message_id.toString(),
					sentMessage.chat.id.toString(),
				);

				// Track in Mixpanel
				await trackMessageInMixpanel(send, template, user);

				// Check if campaign is completed (if broadcast)
				if (send.broadcastId) {
					await checkAndUpdateCampaignStatus(send.broadcastId);
				}

				sentCount++;
			} catch (error) {
				console.error(`[Scheduler] Failed to send message ${send.id}:`, error);

				// Mark as failed
				await markMessageAsFailed(
					send.id,
					error instanceof Error ? error.message : "Unknown error",
					(send.retryCount || 0) + 1,
				);

				failedCount++;
			}
		}

		return {
			success: true,
			sent: sentCount,
			failed: failedCount,
			total: pendingMessages.length,
		};
	} catch (error: any) {
		console.error("[Scheduler] Message sending error:", error);
		return { success: false, error: error.message || "Sending failed" };
	}
}

/**
 * Process follow-up rules and schedule messages
 */
export async function processFollowUpRules() {
	console.log("[Scheduler] Processing follow-up rules...");

	try {
		const rules = await getActiveFollowUpRules();
		let totalProcessed = 0;

		for (const ruleRow of rules) {
			if (!ruleRow.FollowUpRule || !ruleRow.MessageTemplate) continue;

			const rule = ruleRow.FollowUpRule;
			const template = ruleRow.MessageTemplate;

			// Find eligible users for this rule
			const usersToTarget = await getUsersForFollowUp({
				triggerType: rule.triggerType,
				triggerDelayHours: rule.triggerDelayHours,
				targetAudience:
					rule.targetAudience || template.targetAudience || undefined,
				conditions: rule.conditions,
			});

			// Schedule messages for eligible users
			for (const user of usersToTarget) {
				// Check if already received this follow-up
				const alreadyReceived = await hasReceivedFollowUp(user.id, rule.id);

				if (!alreadyReceived) {
					await scheduleMessage({
						userId: user.id,
						templateId: template.id,
						followUpRuleId: rule.id,
						sendType: "follow_up",
						scheduledAt: new Date(),
					});

					totalProcessed++;
				}
			}
		}

		return {
			success: true,
			processed: totalProcessed,
			rulesChecked: rules.length,
		};
	} catch (error) {
		console.error("[Scheduler] Follow-up processing error:", error);
		return { success: false, error: "Processing failed" };
	}
}

/**
 * Process subscription renewals
 */
export async function processSubscriptionRenewals() {
	console.log("[Scheduler] Processing subscription renewals...");

	try {
		// 2. Get expiring subscriptions
		// We check for subscriptions expiring in the next 24 hours
		const expiring = await getExpiringSubscriptions(24);
		console.log(
			`[Scheduler] Checking renewals: found ${expiring.length} candidates.`,
		);

		const results = {
			renewed: 0,
			failed: 0,
			skipped: 0,
		};

		for (const sub of expiring) {
			if (!sub.paymentMethodId) {
				// Should not happen if autoRenew is true, but just in case
				results.skipped++;
				continue;
			}

			const tariff = await getTariffBySlug(sub.tariffSlug);
			if (!tariff) {
				console.error(`[Scheduler] Unknown tariff ${sub.tariffSlug}`);
				results.failed++;
				continue;
			}

			const price = tariff.priceRub;

			// 3. Attempt Payment
			console.log(
				`[Scheduler] Renewing subscription ${sub.id} (User: ${sub.userId})`,
			);

			const payment = await createRecurringPayment(
				price,
				`Auto-renewal: ${sub.tariffSlug}`,
				sub.paymentMethodId,
				"unknown_telegram_id_for_cron", // Placeholder if we don't fetch user
				sub.tariffSlug,
			);

			// 4. Handle Result
			if (payment && payment.status === "succeeded") {
				// Payment successful!
				const duration = tariff.durationDays || 30;

				await extendSubscription(sub.id, duration);
				results.renewed++;
				console.log(`[Scheduler] Renewal successful for ${sub.id}`);

				// TODO: Send notification to user using Telegram Bot API
			} else {
				// Payment failed or requires 3DS
				console.warn(
					`[Scheduler] Renewal failed for ${sub.id}: ${payment?.status}`,
				);
				results.failed++;
			}
		}

		return { success: true, results };
	} catch (error) {
		console.error("[Scheduler] Renewal Error:", error);
		return { success: false, error: "Internal Server Error" };
	}
}
