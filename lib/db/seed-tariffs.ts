import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { tariff } from "./schema";

config({ path: ".env.local" });

const seed = async () => {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("🌱 Seeding tariffs...");

  const tariffs = [
    // 1. Subscription: Pro
    {
      slug: "sub_pro_1",
      name: "Pro (1 мес)",
      type: "subscription",
      priceRub: 400,
      priceStars: 200, // Approx
      durationDays: 30,
      requestLimit: 1500, // Monthly limit
      description: "Базовый тариф на месяц",
    },
    {
      slug: "sub_pro_3",
      name: "Pro (3 мес) -10%",
      type: "subscription",
      priceRub: 1080, // 400 * 3 * 0.9
      priceStars: 540,
      durationDays: 90,
      requestLimit: 1500,
      description: "Выгода 10%",
    },
    {
      slug: "sub_pro_6",
      name: "Pro (6 мес) -15%",
      type: "subscription",
      priceRub: 2040, // 400 * 6 * 0.85
      priceStars: 1020,
      durationDays: 180,
      requestLimit: 1500,
      description: "Выгода 15%",
    },
    {
      slug: "sub_pro_12",
      name: "Pro (12 мес) -20%",
      type: "subscription",
      priceRub: 3840, // 400 * 12 * 0.8
      priceStars: 1920,
      durationDays: 365,
      requestLimit: 1500,
      description: "Выгода 20%",
    },

    // 2. Packets: Extra Requests (Unlimited time, one-off)
    {
      slug: "pack_requests_1500",
      name: "1500 запросов",
      type: "packet",
      priceRub: 400,
      priceStars: 200,
      durationDays: 0, // No expire
      requestLimit: 1500,
      description: "Дополнительные запросы",
    },
    {
      slug: "pack_requests_3000",
      name: "3000 запросов",
      type: "packet",
      priceRub: 750,
      priceStars: 375,
      durationDays: 0,
      requestLimit: 3000,
      description: "Дополнительные запросы",
    },
    {
      slug: "pack_requests_7000",
      name: "7000 запросов",
      type: "packet",
      priceRub: 2000,
      priceStars: 1000,
      durationDays: 0,
      requestLimit: 7000,
      description: "Дополнительные запросы",
    },
  ];

  await db
    .insert(tariff)
    .values(tariffs)
    .onConflictDoUpdate({
      target: tariff.slug,
      set: {
        name: sql`excluded.name`,
        priceRub: sql`excluded.price_rub`,
        priceStars: sql`excluded.price_stars`,
        durationDays: sql`excluded.duration_days`,
        requestLimit: sql`excluded.request_limit`,
        description: sql`excluded.description`,
      },
    });

  console.log("✅ Tariffs seeded successfully");
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
