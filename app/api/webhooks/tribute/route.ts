import { type NextRequest, NextResponse } from "next/server";
import {
  createStarSubscription,
  getTariffBySlug,
  getUserByTelegramId,
  incrementImageGenerationBalance,
} from "@/lib/db/queries";
import { verifyTributeWebhook } from "@/lib/tribute";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("trbt-signature") || "";
    const bodyText = await req.text();

    if (!verifyTributeWebhook(signature, bodyText)) {
      console.error("Invalid Tribute signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(bodyText);

    // Check event type. For shop orders, it might be 'order_paid' or similar.
    // Based on research: "New Subscription (new_subscription)"...
    // For Shop Orders, we expect a status change or specific event.
    // If exact event name is unknown, I'll log it first or assume 'status' field in payload.
    // Let's assume the payload contains the order object directly or wrapped.
    // "payload object includes... tariffSlug" (if I sent it).

    // I previously planned to put tariffSlug in description "tariff_slug:xxx".
    // Or I can use 'order_name' if it was passed cleanly.

    // Let's handle the payload generically for now, looking for status='confirmed' (or 'paid').
    console.log("Tribute Webhook Event:", JSON.stringify(event, null, 2));

    const { status, customer_id, description, amount, currency } =
      event.payload || event;
    // Adjust destructuring based on actual Tribute payload structure (usually wrapped in `payload` or direct).

    if (status !== "confirmed" && status !== "paid" && status !== "success") {
      // Ignore other statuses
      return NextResponse.json({ status: "ok" });
    }

    if (!customer_id) {
      console.error("Missing customer_id in webhook");
      return NextResponse.json({ status: "ok" });
    }

    // Extract Tariff Slug
    // Description format: "Оплата Premium (premium_1) ..." OR "tariff_slug:premium_1"
    // I should strictly format the description in createTributePayment to make this easy.
    // Regex to find "tariff_slug:([a-z0-9_]+)"
    const match = description?.match(/tariff_slug:([a-z0-9_]+)/);
    const tariffSlug = match ? match[1] : null;

    if (!tariffSlug) {
      console.error(
        `Could not extract tariffSlug from description: ${description}`
      );
      return NextResponse.json({ status: "ok" });
    }

    // Processing Logic
    const [user] = await getUserByTelegramId(customer_id);
    if (!user) {
      console.error(`User not found: ${customer_id}`);
      return NextResponse.json({ status: "ok" });
    }

    const tariff = await getTariffBySlug(tariffSlug);
    if (!tariff) {
      console.error(`Tariff not found: ${tariffSlug}`);
      return NextResponse.json({ status: "ok" });
    }

    if (tariff.type === "subscription") {
      const days = tariff.durationDays || 30;
      await createStarSubscription(user.id, tariffSlug, days);
      console.log(`Activated subscription ${tariffSlug} for user ${user.id}`);
    } else {
      // Packet
      let packetAmount = 0;
      const parts = tariffSlug.split("_");
      const possibleAmount = Number.parseInt(parts[parts.length - 1], 10);
      if (!isNaN(possibleAmount)) {
        packetAmount = possibleAmount;
      }
      if (packetAmount > 0) {
        await incrementImageGenerationBalance(user.id, packetAmount);
        console.log(`Added ${packetAmount} gens for user ${user.id}`);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
