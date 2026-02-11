import { eq } from "drizzle-orm";
import { processFollowUpRules } from "./lib/cron-handlers";
import { db } from "./lib/db";
import {
	createFollowUpRule,
	deleteFollowUpRule,
} from "./lib/db/messaging-queries";
import { followUpRule, messageTemplate } from "./lib/db/schema";

async function verifyScheduledFollowUps() {
	console.log("Starting verification of Scheduled Follow-up Rules...");

	// 1. Setup: Create a test template
	let templateId: string | null = null;
	const templateName = "Verification Template " + Date.now();
	try {
		const [template] = await db
			.insert(messageTemplate)
			.values({
				name: templateName,
				content: "Test content",
				templateType: "follow_up",
				targetAudience: "all",
			})
			.returning();
		templateId = template.id;
		console.log(`Created test template: ${templateId}`);
	} catch (e) {
		console.error("Failed to create template", e);
		return;
	}

	if (!templateId) return;

	// 2. Test Case 1: Rule scheduled for TODAY (should run)
	const today = new Date()
		.toLocaleDateString("en-US", { weekday: "short" })
		.toLowerCase();
	const days = [today];

	console.log(`\nTest Case 1: Rule scheduled for ${today} (TODAY)`);
	const rule1 = await createFollowUpRule({
		templateId,
		triggerType: "inactive_user",
		triggerDelayHours: 0, // Immediate
		daysOfWeek: days,
		maxSendsPerUser: 10,
		priority: 100,
	});

	if (rule1) {
		console.log(`Created Rule 1 (${rule1.id}) for [${days}]`);
		const result1 = await processFollowUpRules();
		console.log("Result 1:", result1);
		// We expect it to process users (unless database empty of users)
	}

	// 3. Test Case 2: Rule scheduled for TOMORROW (should NOT run)
	const tomorrowDate = new Date();
	tomorrowDate.setDate(tomorrowDate.getDate() + 1);
	const tomorrow = tomorrowDate
		.toLocaleDateString("en-US", { weekday: "short" })
		.toLowerCase();

	console.log(`\nTest Case 2: Rule scheduled for ${tomorrow} (TOMORROW)`);
	const rule2 = await createFollowUpRule({
		templateId,
		triggerType: "inactive_user",
		triggerDelayHours: 0,
		daysOfWeek: [tomorrow],
		maxSendsPerUser: 10,
		priority: 100,
	});

	if (rule2) {
		console.log(`Created Rule 2 (${rule2.id}) for [${tomorrow}]`);
		const result2 = await processFollowUpRules();
		console.log("Result 2:", result2);
		// We expect this logic to skip rule2
	}

	// 4. Test Case 3: Rule scheduled for FUTURE TIME today (should NOT run)
	const futureTime = new Date();
	futureTime.setHours(futureTime.getHours() + 2); // 2 hours from now
	const timeStr = `${String(futureTime.getHours()).padStart(2, "0")}:${String(futureTime.getMinutes()).padStart(2, "0")}`;

	console.log(`\nTest Case 3: Rule scheduled for time > ${timeStr} (FUTURE)`);
	const rule3 = await createFollowUpRule({
		templateId,
		triggerType: "inactive_user",
		triggerDelayHours: 0,
		sendTimeStart: timeStr,
		maxSendsPerUser: 10,
		priority: 100,
	});

	if (rule3) {
		console.log(`Created Rule 3 (${rule3.id}) with start time ${timeStr}`);
		const result3 = await processFollowUpRules();
		console.log("Result 3:", result3);
	}

	// Cleanup
	console.log("\nCleaning up...");
	if (rule1) await deleteFollowUpRule(rule1.id);
	if (rule2) await deleteFollowUpRule(rule2.id);
	if (rule3) await deleteFollowUpRule(rule3.id);
	await db.delete(messageTemplate).where(eq(messageTemplate.id, templateId));
	console.log("Done.");
}

verifyScheduledFollowUps()
	.catch(console.error)
	.finally(() => process.exit(0));
