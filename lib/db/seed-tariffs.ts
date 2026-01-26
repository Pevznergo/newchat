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
    // Premium Plans
    {
      slug: "premium_1",
      name: "Premium 1 Месяц",
      type: "subscription",
      priceRub: 750,
      priceStars: 500,
      durationDays: 30,
      requestLimit: 100,
      description: "100 запросов в день, все AI модели, без рекламы",
    },
    {
      slug: "premium_3",
      name: "Premium 3 Месяца",
      type: "subscription",
      priceRub: 1800,
      priceStars: 1200,
      durationDays: 90,
      requestLimit: 100,
      description: "Скидка 20%",
    },
    {
      slug: "premium_6",
      name: "Premium 6 Месяцев",
      type: "subscription",
      priceRub: 2925,
      priceStars: 2000,
      durationDays: 180,
      requestLimit: 100,
      description: "Скидка 35%",
    },
    {
      slug: "premium_12",
      name: "Premium 12 Месяцев",
      type: "subscription",
      priceRub: 4500,
      priceStars: 3000,
      durationDays: 360,
      requestLimit: 100,
      description: "Скидка 50%",
    },

    // Premium X2 Plans
    {
      slug: "premium_x2_1",
      name: "Premium X2 1 Месяц",
      type: "subscription",
      priceRub: 1250,
      priceStars: 850,
      durationDays: 30,
      requestLimit: 200,
      description: "200 запросов в день",
    },
    {
      slug: "premium_x2_3",
      name: "Premium X2 3 Месяца",
      type: "subscription",
      priceRub: 3000,
      priceStars: 2000,
      durationDays: 90,
      requestLimit: 200,
      description: "Скидка 20%",
    },
    {
      slug: "premium_x2_6",
      name: "Premium X2 6 Месяцев",
      type: "subscription",
      priceRub: 4875,
      priceStars: 3250,
      durationDays: 180,
      requestLimit: 200,
      description: "Скидка 35%",
    },
    {
      slug: "premium_x2_12",
      name: "Premium X2 12 Месяцев",
      type: "subscription",
      priceRub: 7500,
      priceStars: 5000,
      durationDays: 360,
      requestLimit: 200,
      description: "Скидка 50%",
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
