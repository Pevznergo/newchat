import { resetWeeklyLimits } from "@/lib/db/queries";

export async function GET(request: Request) {
	const authHeader = request.headers.get("authorization");
	if (
		process.env.CRON_SECRET &&
		authHeader !== `Bearer ${process.env.CRON_SECRET}`
	) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const count = await resetWeeklyLimits();

		return Response.json({ status: "ok", updated_count: count });
	} catch (error) {
		console.error("Cron Reset Limits Error:", error);
		return Response.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
