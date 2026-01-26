import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { processSuccessfulPayment } from "@/lib/db/queries";
import { subscription, user } from "@/lib/db/schema";

async function main() {
  console.log("🧪 Testing Payment Processing Logic...");

  // 1. Setup Test User
  const testTelegramId = "999888777";
  const testEmail = `test-webhook-${Date.now()}@example.com`;

  try {
    // Create or find user
    let [testUser] = await db
      .select()
      .from(user)
      .where(eq(user.telegramId, testTelegramId));

    if (testUser) {
      // Reset state
      await db
        .update(user)
        .set({ hasPaid: false })
        .where(eq(user.id, testUser.id));
    } else {
      console.log("Creating test user...");
      [testUser] = await db
        .insert(user)
        .values({
          email: testEmail,
          telegramId: testTelegramId,
          name: "Test User Webhook",
          hasPaid: false,
        })
        .returning();
    }

    console.log(`User ID: ${testUser.id}, Has Paid: ${testUser.hasPaid}`);

    // 2. Simulate Payment
    const tariffSlug = "premium_1";
    const paymentMethodId = "2b9_test_token_123";

    console.log("Processing payment...");
    const result = await processSuccessfulPayment({
      telegramId: testTelegramId,
      tariffSlug,
      paymentMethodId,
      amount: "750.00",
    });

    if (result) {
      console.log("✅ Payment processed successfully result=true");
    } else {
      console.error("❌ processSuccessfulPayment returned false");
    }

    // 3. Verify DB State
    const [updatedUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, testUser.id));
    console.log(
      `Updated User Has Paid: ${updatedUser.hasPaid} (Expected: true)`
    );

    const [sub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, testUser.id))
      .orderBy(desc(subscription.createdAt))
      .limit(1);

    if (sub) {
      console.log("✅ Subscription created!");
      console.log(`   Tariff: ${sub.tariffSlug}`);
      console.log(
        `   Payment Method: ${sub.paymentMethodId} (Expected: ${paymentMethodId})`
      );
      console.log(`   Start: ${sub.startDate}`);
      console.log(`   End: ${sub.endDate}`);

      const daysDiff = Math.ceil(
        (sub.endDate.getTime() - sub.startDate.getTime()) / (1000 * 3600 * 24)
      );
      console.log(`   Duration Days: ${daysDiff} (Expected ~30)`);
    } else {
      console.error("❌ No subscription found!");
    }

    // Cleanup (Optional, maybe keep for manual inspection)
    // await db.delete(user).where(eq(user.id, testUser.id));
  } catch (e) {
    console.error("Test failed:", e);
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit());
