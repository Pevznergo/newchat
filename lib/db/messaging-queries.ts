// Messaging system queries - imported from main queries.ts
import "server-only";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	broadcastCampaign,
	followUpRule,
	messageSend,
	messageTemplate,
	user,
} from "./schema";

// =========================================================================
// FOLLOW-UP RULES QUERIES
// =========================================================================

export async function getActiveFollowUpRules() {
	try {
		return await db
			.select()
			.from(followUpRule)
			.leftJoin(
				messageTemplate,
				eq(followUpRule.templateId, messageTemplate.id),
			)
			.where(eq(followUpRule.isActive, true))
			.orderBy(desc(followUpRule.priority));
	} catch (error) {
		console.error("Failed to get active follow-up rules", error);
		return [];
	}
}

export async function getFollowUpRules(opts?: { isActive?: boolean }) {
	try {
		const conditions = [];
		if (opts?.isActive !== undefined) {
			conditions.push(eq(followUpRule.isActive, opts.isActive));
		}

		return await db
			.select()
			.from(followUpRule)
			.leftJoin(
				messageTemplate,
				eq(followUpRule.templateId, messageTemplate.id),
			)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(followUpRule.priority));
	} catch (error) {
		console.error("Failed to get follow-up rules", error);
		return [];
	}
}

export async function createFollowUpRule(data: {
	templateId: string;
	triggerType: string;
	triggerDelayHours: number;
	conditions?: any;
	targetAudience?: string;
	maxSendsPerUser?: number;
	priority?: number;
}) {
	try {
		const [rule] = await db
			.insert(followUpRule)
			.values({
				templateId: data.templateId,
				triggerType: data.triggerType,
				triggerDelayHours: data.triggerDelayHours,
				conditions: data.conditions,
				targetAudience: data.targetAudience,
				maxSendsPerUser: data.maxSendsPerUser || 1,
				priority: data.priority || 0,
				isActive: true,
			})
			.returning();

		return rule;
	} catch (error) {
		console.error("Failed to create follow-up rule", error);
		return null;
	}
}

// =========================================================================
// MESSAGE SENDS QUERIES FOR CRON
// =========================================================================

export async function getPendingMessages(limit = 100) {
	try {
		return await db
			.select()
			.from(messageSend)
			.leftJoin(messageTemplate, eq(messageSend.templateId, messageTemplate.id))
			.leftJoin(user, eq(messageSend.userId, user.id))
			.where(
				and(
					eq(messageSend.status, "pending"),
					lte(messageSend.scheduledAt, new Date()),
				),
			)
			.limit(limit);
	} catch (error) {
		console.error("Failed to get pending messages", error);
		return [];
	}
}

export async function scheduleMessage(data: {
	userId: string;
	templateId: string;
	followUpRuleId?: string;
	sendType: string;
	scheduledAt?: Date;
}) {
	try {
		const [send] = await db
			.insert(messageSend)
			.values({
				userId: data.userId,
				templateId: data.templateId,
				followUpRuleId: data.followUpRuleId,
				sendType: data.sendType,
				status: "pending",
				scheduledAt: data.scheduledAt || new Date(),
			})
			.returning();

		return send;
	} catch (error) {
		console.error("Failed to schedule message", error);
		return null;
	}
}

export async function markMessageAsSent(
	id: string,
	telegramMessageId: string,
	telegramChatId: string,
) {
	try {
		const [send] = await db
			.update(messageSend)
			.set({
				status: "sent",
				sentAt: new Date(),
				telegramMessageId,
				telegramChatId,
			})
			.where(eq(messageSend.id, id))
			.returning();

		return send;
	} catch (error) {
		console.error("Failed to mark message as sent", error);
		return null;
	}
}

export async function markMessageAsFailed(
	id: string,
	errorMessage: string,
	retryCount: number,
) {
	try {
		const [send] = await db
			.update(messageSend)
			.set({
				status: "failed",
				errorMessage,
				retryCount,
			})
			.where(eq(messageSend.id, id))
			.returning();

		return send;
	} catch (error) {
		console.error("Failed to mark message as failed", error);
		return null;
	}
}

export async function hasReceivedFollowUp(
	userId: string,
	followUpRuleId: string,
): Promise<boolean> {
	try {
		const [result] = await db
			.select({ count: count() })
			.from(messageSend)
			.where(
				and(
					eq(messageSend.userId, userId),
					eq(messageSend.followUpRuleId, followUpRuleId),
				),
			);

		return (result?.count ?? 0) > 0;
	} catch (error) {
		console.error("Failed to check follow-up", error);
		return false;
	}
}

export async function getUsersForFollowUp(rule: {
	triggerType: string;
	triggerDelayHours: number;
	targetAudience?: string;
	conditions?: any;
}) {
	try {
		const cutoffDate = new Date();
		cutoffDate.setHours(cutoffDate.getHours() - rule.triggerDelayHours);

		const conditions = [];

		// Audience filter
		if (rule.targetAudience === "premium") {
			conditions.push(eq(user.hasPaid, true));
		} else if (rule.targetAudience === "free") {
			conditions.push(eq(user.hasPaid, false));
		}

		// Trigger-specific conditions
		if (rule.triggerType === "after_registration") {
			const windowEnd = new Date(cutoffDate);
			windowEnd.setHours(windowEnd.getHours() - 1); // 1-hour window
			conditions.push(gte(user.createdAt, windowEnd));
			conditions.push(lte(user.createdAt, cutoffDate));
		} else if (rule.triggerType === "after_last_message") {
			conditions.push(lte(user.lastVisit, cutoffDate));
		}

		return await db
			.select()
			.from(user)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.limit(1000); // Process in batches
	} catch (error) {
		console.error("Failed to get users for follow-up", error);
		return [];
	}
}

// =========================================================================
// BROADCAST CAMPAIGNS QUERIES
// =========================================================================

export async function getBroadcastCampaigns(status?: string) {
	try {
		const conditions = [];

		if (status && status !== "all") {
			conditions.push(eq(broadcastCampaign.status, status));
		}

		return await db
			.select()
			.from(broadcastCampaign)
			.leftJoin(
				messageTemplate,
				eq(broadcastCampaign.templateId, messageTemplate.id),
			)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(broadcastCampaign.createdAt));
	} catch (error) {
		console.error("Failed to get broadcast campaigns", error);
		return [];
	}
}

export async function createBroadcastCampaign(data: {
	name: string;
	templateId: string;
	targetAudience: string;
	filters?: any;
	scheduledAt?: Date;
	createdBy?: string;
}) {
	try {
		const [campaign] = await db
			.insert(broadcastCampaign)
			.values({
				name: data.name,
				templateId: data.templateId,
				targetAudience: data.targetAudience,
				filters: data.filters,
				scheduledAt: data.scheduledAt,
				createdBy: data.createdBy,
				status: "draft",
			})
			.returning();

		return campaign;
	} catch (error) {
		console.error("Failed to create broadcast campaign", error);
		return null;
	}
}

export async function startBroadcastCampaign(campaignId: string) {
	try {
		// Get campaign and template
		const [campaignRow] = await db
			.select()
			.from(broadcastCampaign)
			.leftJoin(
				messageTemplate,
				eq(broadcastCampaign.templateId, messageTemplate.id),
			)
			.where(eq(broadcastCampaign.id, campaignId))
			.limit(1);

		if (
			!campaignRow ||
			!campaignRow.BroadcastCampaign ||
			!campaignRow.MessageTemplate
		) {
			return null;
		}

		const campaign = campaignRow.BroadcastCampaign;
		const template = campaignRow.MessageTemplate;

		// Get target users based on audience and filters
		const conditions = [];

		if (campaign.targetAudience === "premium") {
			conditions.push(eq(user.hasPaid, true));
		} else if (campaign.targetAudience === "free") {
			conditions.push(eq(user.hasPaid, false));
		}

		// Apply additional filters
		if (campaign.filters && (campaign.filters as any).last_activity_days) {
			const cutoff = new Date();
			cutoff.setDate(
				cutoff.getDate() - (campaign.filters as any).last_activity_days,
			);
			conditions.push(gte(user.lastVisit, cutoff));
		}

		const targetUsers = await db
			.select()
			.from(user)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		// Schedule messages for all target users
		const sends = targetUsers.map((u) => ({
			userId: u.id,
			templateId: template.id,
			broadcastId: campaign.id,
			sendType: "broadcast" as const,
			status: "pending" as const,
			scheduledAt: new Date(),
		}));

		if (sends.length > 0) {
			await db.insert(messageSend).values(sends);
		}

		// Update campaign status
		const [updated] = await db
			.update(broadcastCampaign)
			.set({
				status: "sending",
				totalRecipients: targetUsers.length,
				startedAt: new Date(),
			})
			.where(eq(broadcastCampaign.id, campaignId))
			.returning();

		return updated;
	} catch (error) {
		console.error("Failed to start broadcast campaign", error);
		return null;
	}
}

export async function checkAndUpdateCampaignStatus(campaignId: string) {
	try {
		// Check if there are any pending messages
		const [pending] = await db
			.select({ count: count() })
			.from(messageSend)
			.where(
				and(
					eq(messageSend.broadcastId, campaignId),
					eq(messageSend.status, "pending"),
				),
			);

		if (pending.count === 0) {
			// Mark campaign as completed
			await db
				.update(broadcastCampaign)
				.set({
					status: "completed",
					completedAt: new Date(),
				})
				.where(
					and(
						eq(broadcastCampaign.id, campaignId),
						eq(broadcastCampaign.status, "sending"),
					),
				);
			console.log(`Campaign ${campaignId} marked as completed`);
		}
	} catch (error) {
		console.error("Failed to update campaign status", error);
	}
}

// ... (existing content)

export async function getBroadcastStats(campaignId: string) {
	try {
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (
			!campaignId ||
			campaignId === "undefined" ||
			!uuidRegex.test(campaignId)
		) {
			console.warn(`Invalid campaign ID for stats: ${campaignId}`);
			return { total: 0, sent: 0, failed: 0, pending: 0 };
		}
		const [stats] = await db
			.select({
				total: count(),
				sent: count(sql`CASE WHEN status = 'sent' THEN 1 END`),
				failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
				pending: count(sql`CASE WHEN status = 'pending' THEN 1 END`),
			})
			.from(messageSend)
			.where(eq(messageSend.broadcastId, campaignId));

		return stats || { total: 0, sent: 0, failed: 0, pending: 0 };
	} catch (error) {
		console.error("Failed to get broadcast stats", error);
		return { total: 0, sent: 0, failed: 0, pending: 0 };
	}
}

export async function getBroadcastCampaign(id: string) {
	try {
		const [campaign] = await db
			.select()
			.from(broadcastCampaign)
			.where(eq(broadcastCampaign.id, id));
		return campaign || null;
	} catch (error) {
		console.error("Failed to get broadcast campaign", error);
		return null;
	}
}

export async function updateBroadcastCampaign(
	id: string,
	data: Partial<typeof broadcastCampaign.$inferInsert>,
) {
	try {
		const [campaign] = await db
			.update(broadcastCampaign)
			.set(data)
			.where(eq(broadcastCampaign.id, id))
			.returning();
		return campaign || null;
	} catch (error) {
		console.error("Failed to update broadcast campaign", error);
		return null;
	}
}

export async function getFollowUpRule(id: string) {
	try {
		const [rule] = await db
			.select()
			.from(followUpRule)
			.where(eq(followUpRule.id, id));
		return rule || null;
	} catch (error) {
		console.error("Failed to get follow-up rule", error);
		return null;
	}
}

export async function updateFollowUpRule(
	id: string,
	data: Partial<typeof followUpRule.$inferInsert>,
) {
	try {
		const [rule] = await db
			.update(followUpRule)
			.set(data)
			.where(eq(followUpRule.id, id))
			.returning();
		return rule || null;
	} catch (error) {
		console.error("Failed to update follow-up rule", error);
		return null;
	}
}
