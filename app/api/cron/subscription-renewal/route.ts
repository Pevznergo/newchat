import { NextResponse } from "next/server";
import {
	extendSubscription,
	getExpiringSubscriptions,
	getTariffBySlug,
} from "@/lib/db/queries";
import { createRecurringPayment } from "@/lib/payment";

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
		// 2. Get expiring subscriptions
		// We check for subscriptions expiring in the next 24 hours
		const expiring = await getExpiringSubscriptions(24);
		console.log(`Checking renewals: found ${expiring.length} candidates.`);

		const results = {
			renewed: 0,
			failed: 0,
			skipped: 0,
		};

		for (const sub of expiring) {
			if (!sub.paymentMethodId) {
				// Should not happen if autoRenew is true, but just in case
				results.skipped++;
				continue;
			}

			const tariff = await getTariffBySlug(sub.tariffSlug);
			if (!tariff) {
				console.error(`Unknown tariff ${sub.tariffSlug}`);
				results.failed++;
				continue;
			}

			const price = tariff.priceRub;

			// 3. Attempt Payment
			console.log(`Renewing subscription ${sub.id} (User: ${sub.userId})`);

			const payment = await createRecurringPayment(
				price,
				`Auto-renewal: ${sub.tariffSlug}`,
				sub.paymentMethodId,
				"unknown_telegram_id_for_cron", // Placeholder if we don't fetch user
				sub.tariffSlug,
			);

			// 4. Handle Result
			if (payment && payment.status === "succeeded") {
				// Payment successful!
				const duration = tariff.durationDays || 30;

				await extendSubscription(sub.id, duration);
				results.renewed++;
				console.log(`Renewal successful for ${sub.id}`);

				// TODO: Send notification to user using Telegram Bot API
			} else {
				// Payment failed or requires 3DS
				console.warn(`Renewal failed for ${sub.id}: ${payment?.status}`);
				results.failed++;
			}
		}

		return NextResponse.json({ status: "ok", results });
	} catch (error) {
		console.error("Cron Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
