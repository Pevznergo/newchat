import { autoRetry } from "@grammyjs/auto-retry";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { Bot } from "grammy";
import { CLAN_LEVELS } from "@/lib/clan/config";
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
import {
	cachedAssets,
	messageSend,
	messageTemplate,
	user,
} from "@/lib/db/schema";

import { identifyBackendUser, trackBackendEvent } from "@/lib/mixpanel";
import { createRecurringPayment } from "@/lib/payment";

// Initialize bot
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");
bot.api.config.use(autoRetry());

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

				// Variable Substitution
				// Replace {{name}} and {{credits}}
				let content = template.content;

				// Replace {{name}}
				if (content.includes("{{name}}")) {
					const name = user.name || "User";
					content = content.replace(/{{name}}/g, name);
				}

				// Replace {{credits}}
				if (content.includes("{{credits}}")) {
					// We need clan level to determine credits
					// If we joined clan in getPendingMessages we would have it.
					// But current getPendingMessages might not join clan.
					// Let's rely on user.clanId if available, or just fetch it?
					// Optimization: Update getPendingMessages to join clan?
					// Or just fetch here if needed.
					// Checking msgRow structure: it has User.

					let credits = 15; // Default for Level 1
					if (msgRow.clans?.level) {
						const levelConfig = CLAN_LEVELS[msgRow.clans.level];
						if (levelConfig) {
							credits = levelConfig.benefits.weeklyTextCredits;
						}
					}
					content = content.replace(/{{credits}}/g, credits.toString());
				}

				// Send message via Telegram

				let sentMessage: any;
				if (template.mediaUrl) {
					// 1. Check Cache
					// We try to find a cached file_id for this URL
					let mediaToSend: string = template.mediaUrl;
					let isCached = false;

					try {
						const [cached] = await db
							.select()
							.from(cachedAssets)
							.where(eq(cachedAssets.url, template.mediaUrl))
							.limit(1);

						if (cached) {
							console.log(
								`[Scheduler] Using cached asset for ${template.mediaUrl}`,
							);
							mediaToSend = cached.fileId;
							isCached = true;
						}
					} catch (cacheError) {
						console.error("[Scheduler] Cache lookup failed:", cacheError);
					}

					// 2. Send Media
					if (template.mediaType === "photo") {
						sentMessage = await bot.api.sendPhoto(telegramId, mediaToSend, {
							caption: content,
							...options,
						});
					} else if (template.mediaType === "video") {
						try {
							sentMessage = await bot.api.sendVideo(telegramId, mediaToSend, {
								caption: content,
								...options,
							});
						} catch (videoError: any) {
							console.error(
								`[Scheduler] Video send failed for user ${telegramId}:`,
								videoError.message,
							);
							throw videoError;
						}
					} else if (template.mediaType === "document") {
						sentMessage = await bot.api.sendDocument(telegramId, mediaToSend, {
							caption: content,
							...options,
						});
					} else {
						// Fallback
						sentMessage = await bot.api.sendMessage(
							telegramId,
							template.content,
							options,
						);
					}

					// 3. Save to Cache (if not already cached and we sent a URL)
					if (!isCached && sentMessage) {
						try {
							let fileId = null;
							if (template.mediaType === "photo" && sentMessage.photo) {
								// Determine best quality photo
								fileId =
									sentMessage.photo[sentMessage.photo.length - 1].file_id;
							} else if (template.mediaType === "video" && sentMessage.video) {
								fileId = sentMessage.video.file_id;
							} else if (
								template.mediaType === "document" &&
								sentMessage.document
							) {
								fileId = sentMessage.document.file_id;
							}

							if (fileId) {
								await db
									.insert(cachedAssets)
									.values({
										url: template.mediaUrl,
										fileId: fileId,
										fileType: template.mediaType || "unknown",
									})
									.onConflictDoNothing(); // Safety
								console.log(
									`[Scheduler] Cached asset ${template.mediaUrl} -> ${fileId}`,
								);
							}
						} catch (saveError) {
							console.error(
								"[Scheduler] Failed to save asset to cache:",
								saveError,
							);
						}
					}
				} else {
					sentMessage = await bot.api.sendMessage(telegramId, content, options);
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
			} catch (error: any) {
				console.error(`[Scheduler] Failed to send message ${send.id}:`, error);

				// Check for blocked bot
				if (
					error.error_code === 403 &&
					(error.description?.includes("blocked") ||
						error.message?.includes("blocked"))
				) {
					console.warn(
						`[Scheduler] User ${user.id} (TG: ${telegramId}) blocked the bot. Tracking event.`,
					);
					trackBackendEvent("block_bot", user.id, {
						source: "scheduler_error",
						message_id: send.id,
					});

					// Optionally mark user as inactive in DB?
					// await db.update(user).set({ isActive: false }).where(eq(user.id, user.id));
				}

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

/**
 * Weekly Limit Reminder
 * Sends a reminder to all FREE users about their unused tokens.
 * Runs every Wednesday at 11:00 UTC+3 (08:00 UTC).
 */
export async function processWeeklyLimitReminders() {
	console.log("[Scheduler] Processing weekly limit reminders...");
	try {
		// 1. Find the template
		const templateName = "Weekly Limit Reminder";
		const template = await db.query.messageTemplate.findFirst({
			where: eq(messageTemplate.name, templateName),
		});

		if (!template) {
			console.warn(
				`[Scheduler] Template '${templateName}' not found. Skipping.`,
			);
			return { success: false, error: "Template not found" };
		}

		// 2. Find eligible users (Free users)
		// We want ALL free users who have a telegramId
		// Batch this if userbase is huge, but for now fetch all.
		// Also join with Clan to filter or just to check eligibility?
		// Requirement: "Free users".
		const freeUsers = await db.query.user.findMany({
			where: and(
				eq(user.hasPaid, false),
				isNotNull(user.telegramId),
				ne(user.telegramId, ""),
			),
			columns: { id: true },
		});

		console.log(
			`[Scheduler] Found ${freeUsers.length} free users for reminder.`,
		);

		if (freeUsers.length === 0) {
			return { success: true, scheduled: 0 };
		}

		// 3. Schedule messages
		// Bulk insert or loop? Bulk is better.
		const scheduledAt = new Date(); // Send now

		// Chunking
		const chunkSize = 1000;
		let totalScheduled = 0;

		for (let i = 0; i < freeUsers.length; i += chunkSize) {
			const chunk = freeUsers.slice(i, i + chunkSize);
			const values = chunk.map((u) => ({
				userId: u.id,
				templateId: template.id,
				sendType: "broadcast" as const, // Or new type 'system_reminder'? 'broadcast' fits.
				status: "pending" as const,
				scheduledAt: scheduledAt,
				// No broadcastId strictly needed unless we create a campaign wrapper.
				// Let's treating it as ad-hoc system message.
			}));

			await db.insert(messageSend).values(values);
			totalScheduled += chunk.length;
		}

		console.log(`[Scheduler] Scheduled ${totalScheduled} weekly reminders.`);
		return { success: true, scheduled: totalScheduled };
	} catch (error) {
		console.error("[Scheduler] Weekly Reminder Error:", error);
		return { success: false, error: "Internal Server Error" };
	}
}
