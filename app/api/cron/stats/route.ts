import { NextResponse } from "next/server";
import { sendDailyStatsEmail } from "@/lib/email";
import { getDailyStats } from "@/lib/stats";

export async function GET(request: Request) {
  // Verify Cron Secret (Optional but recommended for Vercel Cron)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    console.log("[CRON] Starting daily stats email job...");

    // Check if RESEND_API_KEY is configured
    if (!process.env.RESEND_API_KEY) {
      console.error("[CRON] RESEND_API_KEY is not set!");
      return NextResponse.json(
        { error: "RESEND_API_KEY not configured" },
        { status: 500 }
      );
    }

    const stats = await getDailyStats();
    console.log("[CRON] Stats collected:", {
      totalUsers: stats.totalUsers,
      newUsers24h: stats.newUsers24h,
      activeUsers24h: stats.activeUsers24h,
    });

    const emailResult = await sendDailyStatsEmail(stats);
    console.log("[CRON] Email send result:", emailResult);

    if (!emailResult.success) {
      console.error("[CRON] Email failed:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send email", details: emailResult.error },
        { status: 500 }
      );
    }

    console.log("[CRON] Job completed successfully");
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("[CRON] Job Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}
