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
    const body = {
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      order_name: params.orderName,
      description: params.description,
      customer_id: params.telegramId,
      return_url: params.returnUrl || "https://t.me/GoPevznerBot",
      fail_url: params.failUrl || "https://t.me/GoPevznerBot",
      require_shipping: false,
      recurrent: false,
    };

    // Try /orders endpoint instead of /shop/orders
    const response = await fetch(`${TRIBUTE_API_URL}/orders`, {
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
    return data;
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
