import { type NextRequest, NextResponse } from "next/server";
import { activateGiftCode } from "@/lib/db/gift-queries";
import { getUserByTelegramId } from "@/lib/db/queries";
import { trackBackendEvent } from "@/lib/mixpanel";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { code, telegramId } = body;

		if (!code) {
			return NextResponse.json({ error: "Code is required" }, { status: 400 });
		}

		// Get user by telegramId or create if needed
		let userId: string;
		if (telegramId) {
			const [user] = await getUserByTelegramId(telegramId);
			if (!user) {
				return NextResponse.json(
					{ error: "User not found. Please start the bot first." },
					{ status: 404 },
				);
			}
			userId = user.id;
		} else {
			return NextResponse.json(
				{ error: "Telegram ID is required" },
				{ status: 400 },
			);
		}

		// Activate gift code
		const result = await activateGiftCode(code, userId, telegramId, "link");

		if (!result.success) {
			// Track failed activation
			trackBackendEvent("Gift Code: Failed", telegramId, {
				code,
				error: result.error,
			});

			return NextResponse.json({ error: result.error }, { status: 400 });
		}

		// Track successful activation
		trackBackendEvent("Gift Code: Activated", telegramId, {
			code,
			subscription_id: result.subscription?.id,
			duration_days: result.subscription?.endDate
				? Math.ceil(
						(new Date(result.subscription.endDate).getTime() -
							new Date(result.subscription.startDate).getTime()) /
							(1000 * 60 * 60 * 24),
					)
				: 0,
		});

		return NextResponse.json(
			{
				success: true,
				subscription: result.subscription,
				message: "Подарок активирован!",
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Gift code activation error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
