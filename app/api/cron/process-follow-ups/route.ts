import { type NextRequest, NextResponse } from "next/server";
import { processFollowUpRules } from "@/lib/cron-handlers";

// Cron job to process follow-up rules
// Schedule: Every 10 minutes via Vercel Cron or external scheduler

export async function GET(request: NextRequest) {
	try {
		// Verify cron authorization
		const authHeader = request.headers.get("authorization");
		const cronSecret = process.env.CRON_SECRET;

		if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const result = await processFollowUpRules();

		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 500 });
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error("Follow-up processing error:", error);
		return NextResponse.json({ error: "Processing failed" }, { status: 500 });
	}
}
