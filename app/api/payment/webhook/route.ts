import { NextResponse } from "next/server";
import { processSuccessfulPayment } from "@/lib/db/queries";
import { trackBackendEvent } from "@/lib/mixpanel";

// Define simplified types for YooKassa event
type YookassaEvent = {
	type: string;
	event: string;
	object: {
		id: string;
		status: string;
		amount: {
			value: string;
			currency: string;
		};
		description?: string;
		payment_method?: {
			type: string;
			id: string;
			saved: boolean;
			title?: string;
		};
		metadata?: {
			telegram_id?: string;
			tariff_slug?: string;
			message_id?: string; // Add message_id
		};
	};
};

export async function POST(request: Request) {
	try {
		const body: YookassaEvent = await request.json();
		console.log("💳 Webhook Received Body:", JSON.stringify(body, null, 2));

		// 1. Check Event Type
		if (body.type !== "notification" || body.event !== "payment.succeeded") {
			console.log(`⚠️ Ignoring event: ${body.event} (Type: ${body.type})`);
			return NextResponse.json({ status: "ignored" });
		}

		const payment = body.object;

		// 2. Extract Metadata
		const telegramId = payment.metadata?.telegram_id;
		const tariffSlug = payment.metadata?.tariff_slug;
		const paymentMethodId = payment.payment_method?.saved
			? payment.payment_method.id
			: undefined;

		if (!telegramId || !tariffSlug) {
			console.error("Missing metadata in payment webhook", payment);
			return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
		}

		// 3. Process Payment
		const success = await processSuccessfulPayment({
			telegramId,
			tariffSlug,
			paymentMethodId,
			// amount: payment.amount.value,
		});

		if (success) {
			trackBackendEvent("Payment: Success", telegramId, {
				amount: Number(payment.amount.value),
				currency: payment.amount.currency,
				tariff: tariffSlug,
				method: body.object.payment_method?.type,
			});

			if (process.env.TELEGRAM_BOT_TOKEN) {
				try {
					const { Bot } = await import("grammy");
					const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

					// Delete the invoice message if ID is present
					if (payment.metadata?.message_id) {
						try {
							await bot.api.deleteMessage(
								telegramId,
								Number(payment.metadata.message_id),
							);
						} catch (e) {
							console.warn("Failed to delete invoice message:", e);
						}
					}

					// Determine subscription duration text
					let durationText = "30 дней";
					if (tariffSlug.endsWith("_12")) {
						durationText = "12 месяцев";
					} else if (tariffSlug.endsWith("_6")) {
						durationText = "6 месяцев";
					} else if (tariffSlug.endsWith("_3")) {
						durationText = "3 месяца";
					} else if (
						tariffSlug.startsWith("midjourney_") ||
						tariffSlug.startsWith("video_") ||
						tariffSlug.startsWith("suno_")
					) {
						durationText = "пакет генераций";
					}

					// Convert date to readable string
					const date = new Date();
					if (durationText !== "пакет генераций") {
						const daysToAdd = durationText.includes("месяц")
							? Number.parseInt(durationText, 10) * 30
							: 30;
						date.setDate(date.getDate() + daysToAdd);
					}

					const dateStr =
						durationText !== "пакет генераций"
							? ` до ${date.toLocaleDateString("ru-RU")}`
							: "";

					await bot.api.sendMessage(
						telegramId,
						`✅ <b>Оплата прошла успешно!</b>\n\nПодписка активирована${dateStr}.\nПриятного использования! 🚀`,
						{ parse_mode: "HTML" },
					);
				} catch (e) {
					console.error("Failed to send Telegram notification:", e);
				}
			}

			return NextResponse.json({ status: "success" });
		}
		return NextResponse.json({ error: "Processing failed" }, { status: 500 });
	} catch (error) {
		console.error("Webhook Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
