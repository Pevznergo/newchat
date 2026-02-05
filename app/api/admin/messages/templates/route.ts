import { type NextRequest, NextResponse } from "next/server";
import { createMessageTemplate, getMessageTemplates } from "@/lib/db/queries";

// GET /api/admin/messages/templates
// List all templates with optional filters
export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const type = searchParams.get("type");
		const audience = searchParams.get("audience");
		const isActive = searchParams.get("isActive");

		const filters: any = {};
		if (type) filters.type = type;
		if (audience) filters.audience = audience;
		if (isActive !== null) filters.isActive = isActive === "true";

		const templates = await getMessageTemplates(filters);

		return NextResponse.json({
			data: templates,
			count: templates.length,
		});
	} catch (error) {
		console.error("GET /api/admin/messages/templates error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch templates" },
			{ status: 500 },
		);
	}
}

// POST /api/admin/messages/templates
// Create a new message template
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Validate required fields
		if (!body.name || !body.content || !body.templateType) {
			return NextResponse.json(
				{ error: "Missing required fields: name, content, templateType" },
				{ status: 400 },
			);
		}

		const template = await createMessageTemplate({
			name: body.name,
			content: body.content,
			contentType: body.contentType,
			mediaType: body.mediaType,
			mediaUrl: body.mediaUrl,
			inlineKeyboard: body.inlineKeyboard,
			templateType: body.templateType,
			targetAudience: body.targetAudience,
			createdBy: body.createdBy,
		});

		if (!template) {
			return NextResponse.json(
				{ error: "Failed to create template" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ data: template }, { status: 201 });
	} catch (error) {
		console.error("POST /api/admin/messages/templates error:", error);
		return NextResponse.json(
			{ error: "Failed to create template" },
			{ status: 500 },
		);
	}
}
