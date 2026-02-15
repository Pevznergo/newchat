import { type NextRequest, NextResponse } from "next/server";
import {
	createGiftCodeBatch,
	deactivateGiftCode,
	getAllGiftCodes,
	getGiftCodeActivations,
	getGiftCodeStats,
} from "@/lib/db/gift-queries";

// TODO: Add admin authentication middleware

// GET /api/admin/gifts
// Get all gift codes with optional filters
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const campaign = searchParams.get("campaign") || undefined;
		const status = searchParams.get("status");
		const codeType = searchParams.get("codeType") || undefined;
		const showUsed = searchParams.get("showUsed") === "true";

		const filters: any = {};
		if (campaign) filters.campaignName = campaign;
		if (status === "active") filters.isActive = true;
		if (status === "inactive") filters.isActive = false;
		if (codeType) filters.codeType = codeType;

		// Default: Hide fully used codes unless showUsed=true
		if (!showUsed) {
			filters.excludeFullyUsed = true;
		}

		const codes = await getAllGiftCodes(filters);

		// Get activation stats for each code
		const codesWithStats = await Promise.all(
			codes.map(async (code) => {
				const stats = await getGiftCodeStats(code.id);
				return {
					...code,
					activationCount: stats?.activationCount || 0,
				};
			}),
		);

		return NextResponse.json({ codes: codesWithStats });
	} catch (error) {
		console.error("GET /api/admin/gifts error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch gift codes" },
			{ status: 500 },
		);
	}
}

// POST /api/admin/gifts
// Create new gift codes
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		console.log("POST /api/admin/gifts body:", body);
		const {
			codeType,
			durationDays,
			quantity,
			campaignName,
			expiresAt,
			priceRub,
			createdBy,
		} = body;

		// Validation
		if (!codeType || !durationDays || !quantity) {
			return NextResponse.json(
				{
					error: "Missing required fields: codeType, durationDays, quantity",
				},
				{ status: 400 },
			);
		}

		if (quantity < 1 || quantity > 1000) {
			return NextResponse.json(
				{ error: "Quantity must be between 1 and 1000" },
				{ status: 400 },
			);
		}

		// Create codes
		const codes = await createGiftCodeBatch({
			codeType,
			durationDays,
			quantity,
			campaignName,
			expiresAt: expiresAt ? new Date(expiresAt) : undefined,
			priceRub,
			createdBy,
		});

		return NextResponse.json(
			{
				success: true,
				codes: codes.map((c) => c.code),
				codeObjects: codes,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("POST /api/admin/gifts error:", error);
		return NextResponse.json(
			{ error: "Failed to create gift codes" },
			{ status: 500 },
		);
	}
}

// DELETE /api/admin/gifts/:id
export async function DELETE(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json(
				{ error: "Gift code ID is required" },
				{ status: 400 },
			);
		}

		await deactivateGiftCode(id);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/admin/gifts error:", error);
		return NextResponse.json(
			{ error: "Failed to deactivate gift code" },
			{ status: 500 },
		);
	}
}
