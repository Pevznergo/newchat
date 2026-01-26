import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  like,
  lt,
  not,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export interface DailyStats {
  totalUsers: number;
  newUsers24h: number;
  activeUsers24h: number;
  clicks24h: number; // Users with source (startParam/utm)
  clickHistory: number[];
  growthHistory: number[]; // Last 7 days new user counts
  tariffBreakdown: { free: number; premium: number };
  sources: { source: string; count: number }[];
}

export async function getDailyStats(): Promise<DailyStats> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Total Users
  const [totalResult] = await db
    .select({ count: count() })
    .from(user)
    .where(or(isNull(user.email), not(like(user.email, "guest%"))));
  const totalUsers = totalResult?.count || 0;

  // 2. New Users (24h)
  const [newResult] = await db
    .select({ count: count() })
    .from(user)
    .where(
      and(
        gte(user.createdAt, yesterday),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    );
  const newUsers24h = newResult?.count || 0;

  // 3. Active Users (24h)
  const [activeResult] = await db
    .select({ count: count() })
    .from(user)
    .where(
      and(
        gte(user.lastVisit, yesterday),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    );
  const activeUsers24h = activeResult?.count || 0;

  // 4. Growth History (Last 7 days) & Click History (Users with Source)
  const growthHistory: number[] = [];
  const clickHistory: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // New Users
    const [dayResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(user)
      .where(
        and(
          gte(user.createdAt, dayStart),
          lt(user.createdAt, dayEnd),
          or(isNull(user.email), not(like(user.email, "guest%")))
        )
      );
    growthHistory.push(dayResult?.count || 0);

    // Clicks (Users with source)
    const [clickResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(user)
      .where(
        and(
          gte(user.createdAt, dayStart),
          lt(user.createdAt, dayEnd),
          or(
            sql`NULLIF(${user.startParam}, '') IS NOT NULL`,
            sql`NULLIF(${user.utmSource}, '') IS NOT NULL`
          ),
          or(isNull(user.email), not(like(user.email, "guest%")))
        )
      );
    clickHistory.push(clickResult?.count || 0);
  }

  // 4.5 Clicks 24h
  const [clicksResult] = await db
    .select({ count: count() })
    .from(user)
    .where(
      and(
        gte(user.createdAt, yesterday),
        or(
          sql`NULLIF(${user.startParam}, '') IS NOT NULL`,
          sql`NULLIF(${user.utmSource}, '') IS NOT NULL`
        ),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    );
  const clicks24h = clicksResult?.count || 0;

  // 5. Tariff Breakdown
  const [paidResult] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(user)
    .where(
      and(
        eq(user.hasPaid, true),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    );
  const premiumCount = paidResult?.count || 0;
  const freeCount = totalUsers - premiumCount;

  // 6. Traffic Sources (QR Codes / UTM)
  const sourcesResult = await db
    .select({
      source: sql<string>`COALESCE(NULLIF(${user.startParam}, ''), NULLIF(${user.utmSource}, ''), 'Unknown')`,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(user)
    .where(
      and(
        or(
          sql`NULLIF(${user.startParam}, '') IS NOT NULL`,
          sql`NULLIF(${user.utmSource}, '') IS NOT NULL`
        ),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    )
    .groupBy(
      sql`COALESCE(NULLIF(${user.startParam}, ''), NULLIF(${user.utmSource}, ''), 'Unknown')`
    )
    .orderBy(desc(count()))
    .limit(5);

  const sources = sourcesResult.map((s) => ({
    source: s.source || "Unknown",
    count: s.count,
  }));

  return {
    totalUsers,
    newUsers24h,
    activeUsers24h,
    clicks24h,
    clickHistory,
    growthHistory,
    tariffBreakdown: { free: freeCount, premium: premiumCount },
    sources,
  };
}
