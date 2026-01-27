import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({ serviceName: "ai-chatbot" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Scheduler] Initializing internal cron scheduler...");

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
            result.error
          );
        }
      } catch (error) {
        console.error("[Scheduler] Error running stats job:", error);
      }
    };

    // Check time every minute
    setInterval(() => {
      const now = new Date();
      // Run at 4:00 and 16:00 UTC (which is roughly 07:00 and 19:00 MSK)
      if (now.getUTCMinutes() === 0) {
        const currentHour = now.getUTCHours();
        if (currentHour === 4 || currentHour === 16) {
          runStatsJob();
        }
      }
    }, 60 * 1000);
  }
}
