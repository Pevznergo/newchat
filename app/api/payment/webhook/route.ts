import { NextResponse } from "next/server";
import { processSuccessfulPayment } from "@/lib/db/queries";

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
    };
  };
};

export async function POST(request: Request) {
  try {
    const body: YookassaEvent = await request.json();

    // 1. Check Event Type
    if (body.type !== "notification" || body.event !== "payment.succeeded") {
      // Ignore other events
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
      // amount: payment.amount.value, // Removed as per signature update
    });

    if (success) {
      return NextResponse.json({ status: "success" });
    }
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
