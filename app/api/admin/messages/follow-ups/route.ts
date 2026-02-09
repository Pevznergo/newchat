import { type NextRequest, NextResponse } from "next/server";
import { createFollowUpRule } from "@/lib/db/messaging-queries";

// POST /api/admin/messages/follow-ups
// Create a new follow-up rule
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Validate required fields
		if (
			!body.templateId ||
			!body.triggerType ||
			body.triggerDelayHours === undefined
		) {
			return NextResponse.json(
				{
					error:
						"Missing required fields: templateId, triggerType, triggerDelayHours",
				},
				{ status: 400 },
			);
		}

		const rule = await createFollowUpRule({
			templateId: body.templateId,
			triggerType: body.triggerType,
			triggerDelayHours: body.triggerDelayHours,
			conditions: body.conditions,
			targetAudience: body.targetAudience,
			maxSendsPerUser: body.maxSendsPerUser || 1,
			priority: body.priority || 0,
		});

		if (!rule) {
			return NextResponse.json(
				{ error: "Failed to create follow-up rule" },
				{ status: 500 },
			);
		}

		// Handle Retroactive Sending
		if (body.sendToExisting) {
			// Trigger async processing (fire and forget, or await if critical)
			// Awaiting here to ensure we report errors if it fails immediately,
			// though for large sets this might be slow.
			// Given it's an admin action, waiting is acceptable for feedback.
			const { processRetroactiveFollowUp } = await import(
				"@/lib/db/messaging-queries"
			);
			// Run in background to avoid timeout
			processRetroactiveFollowUp(rule.id).catch((err) =>
				console.error("Background retroactive process failed", err),
			);
		}

		return NextResponse.json({ data: rule }, { status: 201 });
	} catch (error) {
		console.error("POST /api/admin/messages/follow-ups error:", error);
		return NextResponse.json(
			{ error: "Failed to create follow-up rule" },
			{ status: 500 },
		);
	}
}
