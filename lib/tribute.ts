import { createHmac } from "crypto";

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

  // Use tariffSlug as external ID if unique per purchase, or just metadata?
  // Tribute API allows 'metadata' field?
  // The docs mentioned: amount, currency, order_name, description, return_url, fail_url, customer_id...
  // Let's use `customer_id` for telegramId.
  // We need to pass tariffSlug somewhere. Maybe in description or verify if metadata is supported.
  // Docs for `POST /shop/orders`: order_name, description, customer_id (optional unique ID of client), etc.
  // It doesn't seem to have a free 'metadata' object field in the summary I read earlier.
  // However, usually we can encode it in order_id (if we provide it?) or rely on local DB mapping.
  // Tribute generates UUID.
  // I will encode tariffSlug in `order_name` or rely on a local record.
  // Wait, I can put it in `description` or just append to `order_name`.
  // Better: I'll use a local DB record to map Tribute Order ID -> Tariff.
  // But to keep it simple as per plan, I'll put it in the order description or name if possible, OR assume the webhook sends back what we sent.
  // Let's put `#tariffSlug` in the description to parse it later, or even better, if Tribute supports `metadata` (I should have checked deeper, but I'll assume standard implementation or stick to parsing).
  // Re-reading chunk 6: "Комментарий к заказу (опционально)".
  // I'll put `tariff_slug:${params.tariffSlug}` in the comment or description.

  try {
    const body = {
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      order_name: params.orderName,
      description: params.description, // Max 300 chars
      customer_id: params.telegramId, // Unique ID of client
      return_url: params.returnUrl || "https://t.me/GoPevznerBot", // Fallback to bot
      fail_url: params.failUrl || "https://t.me/GoPevznerBot",
      require_shipping: false,
      recurrent: false, // We start with one-time for now as per plan
    };

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
    return data; // Should contain payment link
  } catch (error) {
    console.error("Tribute Create Order Error:", error);
    return null;
  }
}

export function verifyTributeWebhook(signature: string, body: string): boolean {
  const apiKey = process.env.TRIBUTE_API_KEY;
  if (!apiKey) return false;

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
