// Wrapper to test stats generation
import "dotenv/config";
import { getDailyStats } from "../lib/stats";

async function main() {
  console.log("🔍 Testing Daily Stats Generation...");
  try {
    const stats = await getDailyStats();
    console.log("✅ Stats Generated Successfully:");
    console.log(JSON.stringify(stats, null, 2));

    // Uncomment to test actual email sending if KEY is set
    // console.log("📧 Attempting to send email...");
    // const result = await sendDailyStatsEmail(stats);
    // console.log("Email Result:", result);
  } catch (error) {
    console.error("❌ Error generating stats:", error);
    process.exit(1);
  }
}

main();
