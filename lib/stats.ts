import { and, count, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export interface DailyStats {
  totalUsers: number;
  newUsers24h: number;
  activeUsers24h: number;
  growthHistory: number[]; // Last 7 days new user counts
  tariffBreakdown: { free: number; premium: number };
  sources: { source: string; count: number }[];
}

export async function getDailyStats(): Promise<DailyStats> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Total Users
  const [totalResult] = await db.select({ count: count() }).from(user);
  const totalUsers = totalResult?.count || 0;

  // 2. New Users (24h)
  const [newResult] = await db
    .select({ count: count() })
    .from(user)
    .where(gte(user.createdAt, yesterday));
  const newUsers24h = newResult?.count || 0;

  // 3. Active Users (24h)
  const [activeResult] = await db
    .select({ count: count() })
    .from(user)
    .where(gte(user.lastVisit, yesterday));
  const activeUsers24h = activeResult?.count || 0;

  // 4. Growth History (Last 7 days)
  const growthHistory: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const [dayResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(user)
      .where(and(gte(user.createdAt, dayStart), lt(user.createdAt, dayEnd)));
    growthHistory.push(dayResult?.count || 0);
  }

  // 5. Tariff Breakdown
  const [paidResult] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(user)
    .where(eq(user.hasPaid, true));
  const premiumCount = paidResult?.count || 0;
  const freeCount = totalUsers - premiumCount;

  // 6. Traffic Sources (QR Codes / Start Param)
  const sourcesResult = await db
    .select({
      source: user.startParam,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(user)
    .where(isNotNull(user.startParam))
    .groupBy(user.startParam)
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
    growthHistory,
    tariffBreakdown: { free: freeCount, premium: premiumCount },
    sources,
  };
}
