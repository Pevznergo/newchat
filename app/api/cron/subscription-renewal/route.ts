import { NextResponse } from "next/server";
import { processSubscriptionRenewals } from "@/lib/cron-handlers";

export async function GET(request: Request) {
	// 1. Authorization Check
	const authHeader = request.headers.get("authorization");
	if (
		process.env.CRON_SECRET &&
		authHeader !== `Bearer ${process.env.CRON_SECRET}`
	) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		const result = await processSubscriptionRenewals();

		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 500 });
		}

		return NextResponse.json({ status: "ok", results: result.results });
	} catch (error) {
		console.error("Cron Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
