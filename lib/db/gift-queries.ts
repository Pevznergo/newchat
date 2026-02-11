import crypto from "node:crypto";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	type GiftCode,
	type GiftCodeActivation,
	giftCode,
	giftCodeActivation,
	subscription,
	user,
} from "@/lib/db/schema";

/**
 * Generate a cryptographically secure gift code
 */
export function generateGiftCode(campaign?: string): string {
	const random = crypto.randomBytes(4).toString("hex").toUpperCase();
	if (campaign) {
		const slug = campaign.replace(/\s+/g, "").slice(0, 8).toUpperCase();
		return `GIFT-${slug}-${random}`;
	}
	return `GIFT-${random}`;
}

/**
 * Create a new gift code
 */
export async function createGiftCode(params: {
	codeType: string;
	durationDays: number;
	campaignName?: string;
	expiresAt?: Date;
	priceRub?: number;
	createdBy?: string;
	maxUses?: number;
}): Promise<GiftCode> {
	const code = generateGiftCode(params.campaignName);

	const [newCode] = await db
		.insert(giftCode)
		.values({
			code,
			codeType: params.codeType,
			durationDays: params.durationDays,
			campaignName: params.campaignName,
			expiresAt: params.expiresAt,
			priceRub: params.priceRub,
			createdBy: params.createdBy,
			maxUses: params.maxUses || 1,
		})
		.returning();

	return newCode;
}

/**
 * Create multiple gift codes in batch
 */
export async function createGiftCodeBatch(params: {
	codeType: string;
	durationDays: number;
	quantity: number;
	campaignName?: string;
	expiresAt?: Date;
	priceRub?: number;
	createdBy?: string;
}): Promise<GiftCode[]> {
	const codes: (typeof giftCode.$inferInsert)[] = [];

	for (let i = 0; i < params.quantity; i++) {
		const code = generateGiftCode(params.campaignName);
		codes.push({
			code,
			codeType: params.codeType,
			durationDays: params.durationDays,
			campaignName: params.campaignName,
			expiresAt: params.expiresAt,
			priceRub: params.priceRub,
			createdBy: params.createdBy,
			maxUses: 1,
		});
	}

	return await db.insert(giftCode).values(codes).returning();
}

/**
 * Validate if a gift code is valid and available for use
 */
export async function validateGiftCode(code: string): Promise<{
	valid: boolean;
	error?: string;
	code?: GiftCode;
}> {
	const [giftCodeRecord] = await db
		.select()
		.from(giftCode)
		.where(eq(giftCode.code, code.toUpperCase()))
		.limit(1);

	if (!giftCodeRecord) {
		return { valid: false, error: "Код не найден" };
	}

	if (!giftCodeRecord.isActive) {
		return { valid: false, error: "Код деактивирован" };
	}

	if (giftCodeRecord.expiresAt && new Date() > giftCodeRecord.expiresAt) {
		return { valid: false, error: "Срок действия кода истёк" };
	}

	if ((giftCodeRecord.currentUses ?? 0) >= (giftCodeRecord.maxUses ?? 1)) {
		return { valid: false, error: "Код уже использован" };
	}

	return { valid: true, code: giftCodeRecord };
}

/**
 * Activate a gift code for a user
 */
export async function activateGiftCode(
	code: string,
	userId: string,
	telegramId?: string,
	source: "link" | "qr" | "manual" = "link",
): Promise<{
	success: boolean;
	error?: string;
	subscription?: any;
}> {
	// Validate code
	const validation = await validateGiftCode(code);
	if (!validation.valid || !validation.code) {
		return { success: false, error: validation.error };
	}

	const giftCodeRecord = validation.code;

	// Check if user already activated this code
	const existingActivation = await db
		.select()
		.from(giftCodeActivation)
		.where(
			and(
				eq(giftCodeActivation.giftCodeId, giftCodeRecord.id),
				eq(giftCodeActivation.userId, userId),
			),
		)
		.limit(1);

	if (existingActivation.length > 0) {
		return { success: false, error: "Вы уже активировали этот код" };
	}

	// Create subscription
	const startDate = new Date();
	const endDate = new Date();
	endDate.setDate(endDate.getDate() + giftCodeRecord.durationDays);

	const [newSubscription] = await db
		.insert(subscription)
		.values({
			userId,
			tariffSlug: giftCodeRecord.codeType,
			status: "active",
			autoRenew: false,
			startDate,
			endDate,
		})
		.returning();

	// Update user's hasPaid status
	await db.update(user).set({ hasPaid: true }).where(eq(user.id, userId));

	// Record activation
	await db.insert(giftCodeActivation).values({
		giftCodeId: giftCodeRecord.id,
		userId,
		subscriptionId: newSubscription.id,
		userTelegramId: telegramId,
		userSource: source,
	});

	// Update gift code usage count
	await db
		.update(giftCode)
		.set({
			currentUses: sql`${giftCode.currentUses} + 1`,
			// If single-use, mark as used
			...(giftCodeRecord.maxUses === 1
				? { activatedBy: userId, activatedAt: new Date() }
				: {}),
		})
		.where(eq(giftCode.id, giftCodeRecord.id));

	return { success: true, subscription: newSubscription };
}

/**
 * Get gift code statistics
 */
export async function getGiftCodeStats(codeId: string) {
	const [stats] = await db
		.select({
			code: giftCode,
			activationCount: sql<number>`COUNT(${giftCodeActivation.id})`,
		})
		.from(giftCode)
		.leftJoin(
			giftCodeActivation,
			eq(giftCodeActivation.giftCodeId, giftCode.id),
		)
		.where(eq(giftCode.id, codeId))
		.groupBy(giftCode.id);

	return stats;
}

/**
 * Get all gift codes with optional filters
 */
export async function getAllGiftCodes(filters?: {
	campaignName?: string;
	isActive?: boolean;
	codeType?: string;
}): Promise<GiftCode[]> {
	const conditions = [];

	if (filters?.campaignName) {
		conditions.push(eq(giftCode.campaignName, filters.campaignName));
	}

	if (filters?.isActive !== undefined) {
		conditions.push(eq(giftCode.isActive, filters.isActive));
	}

	if (filters?.codeType) {
		conditions.push(eq(giftCode.codeType, filters.codeType));
	}

	return await db
		.select()
		.from(giftCode)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(giftCode.createdAt));
}

/**
 * Deactivate a gift code
 */
export async function deactivateGiftCode(
	codeId: string,
): Promise<{ success: boolean }> {
	await db
		.update(giftCode)
		.set({ isActive: false })
		.where(eq(giftCode.id, codeId));

	return { success: true };
}

/**
 * Get gift code by code string
 */
export async function getGiftCodeByCode(
	code: string,
): Promise<GiftCode | null> {
	const [giftCodeRecord] = await db
		.select()
		.from(giftCode)
		.where(eq(giftCode.code, code.toUpperCase()))
		.limit(1);

	return giftCodeRecord || null;
}

/**
 * Get activation history for a gift code
 */
export async function getGiftCodeActivations(
	codeId: string,
): Promise<GiftCodeActivation[]> {
	return await db
		.select()
		.from(giftCodeActivation)
		.where(eq(giftCodeActivation.giftCodeId, codeId))
		.orderBy(desc(giftCodeActivation.activatedAt));
}
