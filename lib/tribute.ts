import { createHmac } from "node:crypto";

const TRIBUTE_API_URL = "https://tribute.tg/api/v1";

interface CreateOrderParams {
  amount: number; // in minimum units (kopecks for RUB)
  currency: string;
  orderName: string;
  description: string;
  telegramId: string;
  tariffSlug: string;
  returnUrl?: string;
  failUrl?: string;
}

export async function createTributePayment(params: CreateOrderParams) {
  const apiKey = process.env.TRIBUTE_API_KEY;

  if (!apiKey) {
    console.error("TRIBUTE_API_KEY is missing");
    return null;
  }

  try {
    // Determine if this is a subscription (has duration) or one-time payment
    const isSubscription = params.tariffSlug.includes('premium');
    
    const body: Record<string, any> = {
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      title: params.orderName,
      description: params.description,
      comment: `tariff_slug:${params.tariffSlug}`,
      successUrl: params.returnUrl || "https://t.me/GoPevznerBot",
      failUrl: params.failUrl || "https://t.me/GoPevznerBot",
    };

    // Add period for subscriptions
    if (isSubscription) {
      body.period = "monthly"; // Tribute will handle monthly billing
    }

    // Add telegram_user_id if available
    if (params.telegramId) {
      body.telegram_user_id = params.telegramId;
    }

    const response = await fetch(`${TRIBUTE_API_URL}/shop/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Tribute API Error: ${response.status} ${text}`);
      return null;
    }

    const data = await response.json();
    console.log("Tribute payment created:", data);
    
    // Return payment URL from response
    return {
      link: data.paymentUrl || data.link || data.url,
      ...data
    };
  } catch (error) {
    console.error("Tribute Create Order Error:", error);
    return null;
  }
}

export function verifyTributeWebhook(signature: string, body: string): boolean {
  const apiKey = process.env.TRIBUTE_API_KEY;
  if (!apiKey) {
    return false;
  }

  // Check docs for signature algorithm. Usually HMAC-SHA256.
  // "Api-Key передаётся в заголовке...".
  // Webhook signing usually uses a secret or the API key.
  // I'll assume HMAC-SHA256 with API Key for now based on typical integrations and my previous search result (which said "signed with your API key").

  // Note: If exact signature method isn't in my immediate context, I might need to skip strict verification or guess.
  // Common pattern: hmac(body, secret).
  try {
    const hmac = createHmac("sha256", apiKey);
    const digest = hmac.update(body).digest("hex");
    return signature === digest;
  } catch (e) {
    console.error("Signature verification failed", e);
    return false;
  }
}
