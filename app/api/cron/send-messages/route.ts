import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import { type NextRequest, NextResponse } from "next/server";
import { processPendingMessages } from "@/lib/cron-handlers";
import { db } from "@/lib/db";
import {
	checkAndUpdateCampaignStatus,
	getPendingMessages,
	markMessageAsFailed,
	markMessageAsSent,
} from "@/lib/db/messaging-queries";
import { messageSend } from "@/lib/db/schema";
import { identifyBackendUser, trackBackendEvent } from "@/lib/mixpanel";

// Cron job to send pending messages
// Schedule: Every 1 minute via Vercel Cron or external scheduler

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");

export async function GET(request: NextRequest) {
	try {
		// Verify cron authorization (bypass in development or if no secret set)
		const authHeader = request.headers.get("authorization");
		const cronSecret = process.env.CRON_SECRET;

		console.log("[Cron] Starting message processing...", {
			env: process.env.NODE_ENV,
			hasSecret: !!cronSecret,
			authHeader,
		});

		if (
			process.env.NODE_ENV === "production" &&
			cronSecret &&
			authHeader !== `Bearer ${cronSecret}`
		) {
			console.warn("[Cron] Unauthorized attempt");
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const result = await processPendingMessages();

		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 500 });
		}

		return NextResponse.json(result);
	} catch (error: any) {
		console.error("Message sending error:", error);
		return NextResponse.json(
			{ error: error.message || "Sending failed" },
			{ status: 500 },
		);
	}
}
