import { type NextRequest, NextResponse } from "next/server";
import {
  createStarSubscription,
  getTariffBySlug,
  getUserByTelegramId,
  incrementImageGenerationBalance,
  incrementMusicGenerationBalance,
  incrementVideoGenerationBalance,
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

    console.log("Tribute Webhook Event:", JSON.stringify(event, null, 2));

    const { status, customer_id, description } = event.payload || event;

    if (status !== "confirmed" && status !== "paid" && status !== "success") {
      return NextResponse.json({ status: "ok" });
    }

    if (!customer_id) {
      console.error("Missing customer_id in webhook");
      return NextResponse.json({ status: "ok" });
    }

    // Extract Tariff Slug from description "tariff_slug:premium_1"
    const match = description?.match(/tariff_slug:([a-z0-9_]+)/);
    const tariffSlug = match ? match[1] : null;

    if (!tariffSlug) {
      console.error(
        `Could not extract tariffSlug from description: ${description}`
      );
      return NextResponse.json({ status: "ok" });
    }

    // Get user
    const [user] = await getUserByTelegramId(customer_id);
    if (!user) {
      console.error(`User not found: ${customer_id}`);
      return NextResponse.json({ status: "ok" });
    }

    // Get tariff
    const tariff = await getTariffBySlug(tariffSlug);
    if (!tariff) {
      console.error(`Tariff not found: ${tariffSlug}`);
      return NextResponse.json({ status: "ok" });
    }

    // Process based on type
    if (tariff.type === "subscription") {
      const days = tariff.durationDays || 30;
      await createStarSubscription(user.id, tariffSlug, days);
      console.log(
        `✅ Activated subscription ${tariffSlug} for user ${user.id}`
      );
    } else {
      // Packet - parse amount from slug
      let packetAmount = 0;
      const parts = tariffSlug.split("_");
      const possibleAmount = Number.parseInt(parts.at(-1) || "0", 10);
      if (!Number.isNaN(possibleAmount)) {
        packetAmount = possibleAmount;
      }

      if (packetAmount > 0) {
        if (tariffSlug.startsWith("midjourney_")) {
          await incrementImageGenerationBalance(user.id, packetAmount);
          console.log(
            `✅ Added ${packetAmount} image gens for user ${user.id}`
          );
        } else if (tariffSlug.startsWith("video_")) {
          await incrementVideoGenerationBalance(user.id, packetAmount);
          console.log(
            `✅ Added ${packetAmount} video gens for user ${user.id}`
          );
        } else if (tariffSlug.startsWith("music_")) {
          await incrementMusicGenerationBalance(user.id, packetAmount);
          console.log(
            `✅ Added ${packetAmount} music gens for user ${user.id}`
          );
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
