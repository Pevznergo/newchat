import { registerOTel } from "@vercel/otel";

export function register() {
	registerOTel({ serviceName: "ai-chatbot" });

	if (process.env.NEXT_RUNTIME === "nodejs") {
		console.log("[Scheduler] Initializing internal cron scheduler...");

		// Import handlers dynamically to avoid build-time issues
		const runStatsJob = async () => {
			try {
				console.log("[Scheduler] Triggering stats job...");
				const { getDailyStats } = await import("@/lib/stats");
				const { sendDailyStatsEmail } = await import("@/lib/email");

				const stats = await getDailyStats();
				const result = await sendDailyStatsEmail(stats);
				if (result.success) {
					console.log("[Scheduler] Stats email sent successfully");
				} else {
					console.error(
						"[Scheduler] Failed to send stats email:",
						result.error,
					);
				}
			} catch (error) {
				console.error("[Scheduler] Error running stats job:", error);
			}
		};

		const runMessageJob = async () => {
			try {
				const { processPendingMessages } = await import("@/lib/cron-handlers");
				await processPendingMessages();
			} catch (error) {
				console.error("[Scheduler] Error running message job:", error);
			}
		};

		const runFollowUpJob = async () => {
			try {
				const { processFollowUpRules } = await import("@/lib/cron-handlers");
				await processFollowUpRules();
			} catch (error) {
				console.error("[Scheduler] Error running follow-up job:", error);
			}
		};

		const runRenewalJob = async () => {
			try {
				const { processSubscriptionRenewals } = await import(
					"@/lib/cron-handlers"
				);
				await processSubscriptionRenewals();
			} catch (error) {
				console.error("[Scheduler] Error running renewal job:", error);
			}
		};

		const runWeeklyReminderJob = async () => {
			try {
				const { processWeeklyLimitReminders } = await import(
					"@/lib/cron-handlers"
				);
				await processWeeklyLimitReminders();
			} catch (error) {
				console.error("[Scheduler] Error running weekly reminder job:", error);
			}
		};

		// Check time every minute
		setInterval(() => {
			const now = new Date();
			const minutes = now.getUTCMinutes();
			const hours = now.getUTCHours();
			const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 3 = Wednesday

			// 1. Stats Job: Run at 4:00 and 16:00 UTC (07:00 and 19:00 MSK)
			if (minutes === 0) {
				if (hours === 4 || hours === 16) {
					runStatsJob();
				}
			}

			// 2. Messaging Job: Run every minute
			runMessageJob();

			// 3. Follow-up Job: Run every 10 minutes (at :00, :10, :20, etc.)
			if (minutes % 10 === 0) {
				runFollowUpJob();
			}

			// 4. Renewal Job: Run every hour (at :00)
			if (minutes === 0) {
				runRenewalJob();
			}

			// 5. Weekly Reminder Job: Run every Wednesday at 11:00 MSK (08:00 UTC)
			if (day === 3 && hours === 8 && minutes === 0) {
				runWeeklyReminderJob();
			}
		}, 60 * 1000); // Check every 60 seconds
	}
}
