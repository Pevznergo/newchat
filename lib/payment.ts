import { generateUUID } from "@/lib/utils";

const SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;

/**
 * Create a new payment (One-time or Initial for recurring)
 * This requires user interaction (redirect)
 */
export async function createYookassaPayment(
	amount: number,
	description: string,
	telegramId: string,
	tariffSlug: string,
	messageId?: number,
) {
	if (!SHOP_ID || !SECRET_KEY) {
		console.error("Missing YooKassa credentials");
		return null;
	}

	const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64");
	const idempotencyKey = generateUUID();

	try {
		const response = await fetch("https://api.yookassa.ru/v3/payments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${auth}`,
				"Idempotence-Key": idempotencyKey,
			},
			body: JSON.stringify({
				amount: {
					value: amount.toFixed(2),
					currency: "RUB",
				},
				capture: true,
				confirmation: {
					type: "redirect",
					return_url: "https://aporto.tech/api/payment/return",
				},
				description,
				metadata: {
					telegram_id: telegramId,
					tariff_slug: tariffSlug,
					message_id: messageId,
				},
				save_payment_method: true, // Important for recurring!
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("YooKassa Error:", errorText);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error("YooKassa Fetch Error:", error);
		return null;
	}
}

/**
 * Charge a saved payment method (Recurring)
 * This does usually NOT require user interaction, unless 3DS is enforced.
 */
export async function createRecurringPayment(
	amount: number,
	description: string,
	paymentMethodId: string,
	telegramId: string,
	tariffSlug: string,
) {
	if (!SHOP_ID || !SECRET_KEY) {
		console.error("Missing YooKassa credentials");
		return null;
	}

	const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64");
	const idempotencyKey = generateUUID();

	try {
		const response = await fetch("https://api.yookassa.ru/v3/payments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${auth}`,
				"Idempotence-Key": idempotencyKey,
			},
			body: JSON.stringify({
				amount: {
					value: amount.toFixed(2),
					currency: "RUB",
				},
				capture: true,
				payment_method_id: paymentMethodId,
				description,
				metadata: {
					telegram_id: telegramId,
					tariff_slug: tariffSlug,
					is_recurring: "true",
				},
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("YooKassa Recurring Error:", errorText);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error("YooKassa Recurring Fetch Error:", error);
		return null;
	}
}
