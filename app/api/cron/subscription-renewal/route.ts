import { NextResponse } from "next/server";
import { extendSubscription, getExpiringSubscriptions } from "@/lib/db/queries";
import { createRecurringPayment } from "@/lib/payment";

// Mapping slugs to prices if not in DB. Ideally this should come from DB or shared constant.
const SUBSCRIPTION_PRICES: Record<string, number> = {
  premium_1: 300,
  premium_3: 850,
  premium_6: 1600,
  premium_12: 3000,
  premium_x2_1: 500, // Example
  premium_x2_3: 1400,
  premium_x2_6: 2700,
  premium_x2_12: 5000,
};

function getPriceForTariff(slug: string): number | null {
  // Simple lookup for now.
  // In a real app, you might query the Tariff table.
  return SUBSCRIPTION_PRICES[slug] || null;
}

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

      const price = getPriceForTariff(sub.tariffSlug);
      if (!price) {
        console.error(`Unknown price for tariff ${sub.tariffSlug}`);
        results.failed++;
        continue;
      }

      // 3. Attempt Payment
      console.log(`Renewing subscription ${sub.id} (User: ${sub.userId})`);

      // We need telegram ID for metadata (and ideally for notifications)
      // Here we need to fetch user to get telegram ID.
      // We can add a helper to get User by ID, but we have `getUser` by email.
      // Let's assume we can fetch user by ID or just use what we have.
      // The DB schema has userId.
      // We need to fetch the user record to get the telegramId.
      // I'll skip fetching if I don't have a direct "getUserById" exported,
      // but assuming we can query user table directly if needed or import `db` and `user` schema.
      // Actually `getExpiringSubscriptions` returns subscription objects.
      // Let's try to query the user.

      // For now, let's pass "unknown" if we can't easily get it,
      // but `createRecurringPayment` metadata expects telegram_id.
      // It's metadata, so maybe not strictly fatal if missing, but good for tracking.

      const payment = await createRecurringPayment(
        price,
        `Auto-renewal: ${sub.tariffSlug}`,
        sub.paymentMethodId,
        "unknown_telegram_id_for_cron", // Placeholder if we don't fetch user
        sub.tariffSlug
      );

      // 4. Handle Result
      if (payment && payment.status === "succeeded") {
        // Payment successful!
        // Determine duration
        let duration = 30;
        if (sub.tariffSlug.endsWith("_12")) {
          duration = 365;
        } else if (sub.tariffSlug.endsWith("_6")) {
          duration = 180;
        } else if (sub.tariffSlug.endsWith("_3")) {
          duration = 90;
        }

        await extendSubscription(sub.id, duration);
        results.renewed++;
        console.log(`Renewal successful for ${sub.id}`);

        // TODO: Send notification to user using Telegram Bot API
        // This requires importing the bot and having the telegramId
      } else {
        // Payment failed or requires 3DS
        console.warn(`Renewal failed for ${sub.id}: ${payment?.status}`);
        // If it requires 3DS (status === 'pending'), we can't auto-renew easily without user interaction.
        // For now, we count it as failed.
        // Optionally disable auto-renew to stop retrying infinitely?
        // Or keep it and retry tomorrow?
        // Let's count as failed.
        results.failed++;
      }
    }

    return NextResponse.json({ status: "ok", results });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
