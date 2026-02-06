import { type NextRequest, NextResponse } from "next/server";
import { getBroadcastStats } from "@/lib/db/messaging-queries";

// GET /api/admin/messages/broadcasts/[id]/stats
// Get real-time statistics for a broadcast campaign
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	try {
		if (id === "undefined") {
			return NextResponse.json(
				{ error: "Invalid campaign ID" },
				{ status: 400 },
			);
		}
		const stats = await getBroadcastStats(id);

		return NextResponse.json({ data: stats });
	} catch (error) {
		console.error(
			`GET /api/admin/messages/broadcasts/${id}/stats error:`,
			error,
		);
		return NextResponse.json(
			{ error: "Failed to fetch stats" },
			{ status: 500 },
		);
	}
}
