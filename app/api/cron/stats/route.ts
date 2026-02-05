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
		const stats = await getDailyStats();
		const emailResult = await sendDailyStatsEmail(stats);

		if (!emailResult.success) {
			return NextResponse.json(
				{ error: "Failed to send email", details: emailResult.error },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true, stats });
	} catch (error) {
		console.error("Cron Job Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
