import { eq } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { user } from "@/lib/db/schema";

/**
 * Check and reset monthly premium request limits
 * For premium users: 1500 requests per month, resets every month
 */
export async function checkAndResetMonthlyPremiumLimits(
	userId: string,
	lastResetDate: Date | null,
): Promise<boolean> {
	const now = new Date();

	// Calculate start of current month
	const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	currentMonthStart.setHours(0, 0, 0, 0);

	// If lastResetDate is before current month start -> reset needed
	const needsReset = !lastResetDate || lastResetDate < currentMonthStart;

	if (needsReset) {
		console.log(`[MonthlyReset] Resetting premium limits for user ${userId}`);
		await db
			.update(user)
			.set({
				requestCount: 0,
				lastResetDate: new Date(),
			})
			.where(eq(user.id, userId));
		return true;
	}
	return false;
}
