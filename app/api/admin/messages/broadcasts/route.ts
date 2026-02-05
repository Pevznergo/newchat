import { type NextRequest, NextResponse } from "next/server";
import {
	createBroadcastCampaign,
	getBroadcastCampaigns,
} from "@/lib/db/messaging-queries";

// GET /api/admin/messages/broadcasts
// List all broadcast campaigns
export async function GET(request: NextRequest) {
	try {
		const campaigns = await getBroadcastCampaigns();

		return NextResponse.json({
			data: campaigns,
			count: campaigns.length,
		});
	} catch (error) {
		console.error("GET /api/admin/messages/broadcasts error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch campaigns" },
			{ status: 500 },
		);
	}
}

// POST /api/admin/messages/broadcasts
// Create a new broadcast campaign
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Validate required fields
		if (!body.name || !body.templateId || !body.targetAudience) {
			return NextResponse.json(
				{
					error: "Missing required fields: name, templateId, targetAudience",
				},
				{ status: 400 },
			);
		}

		const campaign = await createBroadcastCampaign({
			name: body.name,
			templateId: body.templateId,
			targetAudience: body.targetAudience,
			filters: body.filters,
			scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
			createdBy: body.createdBy,
		});

		if (!campaign) {
			return NextResponse.json(
				{ error: "Failed to create campaign" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ data: campaign }, { status: 201 });
	} catch (error) {
		console.error("POST /api/admin/messages/broadcasts error:", error);
		return NextResponse.json(
			{ error: "Failed to create campaign" },
			{ status: 500 },
		);
	}
}
